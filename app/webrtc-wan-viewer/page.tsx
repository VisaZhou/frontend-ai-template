'use client';

import { useEffect, useRef, useState } from 'react';

export default function ViewerPage() {
  const [status, setStatus] = useState('disconnected');
  const [canPlay, setCanPlay] = useState(false);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 连续多少次空候选者后停止轮询
  const maxEmptyPollCount = 5;
  const emptyPollCountRef = useRef(0);

  const sessionId = 'abc1234'; // 建议改为参数或动态传入

  const initWebRTC = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      // ICE状态变化监听
      pc.onicegatheringstatechange = () => {
        console.log('ICE gathering state changed:', pc.iceGatheringState);
      };

      // 远程 track 事件处理，设置视频流
      pc.ontrack = (event) => {
        console.log('收到远程 track:', event.track.kind);
        const videoEl = remoteVideoRef.current;
        if (videoEl && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          videoEl.onloadedmetadata = () => {
            setCanPlay(true);
          };
        }
      };

      // 本地 ICE Candidate 收集后发送给后端
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('发送本地 ICE candidate:', event.candidate);
          fetch('http://192.168.78.102:8000/api/wan/candidate/subscriber', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            })
          }).catch(console.error);
        } else {
          console.log('ICE candidate gathering completed');
        }
      };

      // 连接状态变化监听，断开时清理
      pc.onconnectionstatechange = () => {
        console.log('连接状态:', pc.connectionState);
        setStatus(pc.connectionState);

        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanup();
        }
      };

      // 订阅视频流
      pc.addTransceiver('video', { direction: 'recvonly' });

      // 创建Offer并发送给后端
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('创建本地 SDP Offer:', offer.sdp);

      const res = await fetch('http://192.168.78.102:8000/api/wan/offer/subscriber', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          sdp: offer.sdp
        })
      });

      const { sdp: answerSdp } = await res.json();
      console.log('收到 Answer SDP:', answerSdp);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
      console.log('设置远端 SDP 完成');

      // 启动轮询 ICE Candidate
      pollIntervalRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`http://192.168.78.102:8000/api/wan/candidate/poll?sessionId=${sessionId}`);
          const candidates = await resp.json();

          if (candidates.length > 0) {
            emptyPollCountRef.current = 0;
            for (const c of candidates) {
              console.log('添加远端 ICE candidate:', c);
              await pc.addIceCandidate(new RTCIceCandidate(c));
            }
          } else {
            emptyPollCountRef.current++;
            if (emptyPollCountRef.current >= maxEmptyPollCount) {
              // 超过连续空次数，停止轮询
              console.log('连续多次无候选者，停止轮询 ICE Candidates');
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          }
        } catch (e) {
          console.error('轮询 ICE Candidate 失败:', e);
        }
      }, 1000);

    } catch (err) {
      console.error('WebRTC 初始化失败:', err);
      setStatus('error');
    }
  };

  // 清理资源函数
  const cleanup = () => {
    if (peerConnectionRef.current) {
      console.log('关闭 PeerConnection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setCanPlay(false);
    setStatus('disconnected');
  };

  useEffect(() => {
    initWebRTC();

    return () => {
      cleanup();
    };
  }, []);

  const handlePlay = () => {
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      videoEl.play().catch(err => console.error('播放失败:', err));
    }
  };

  return (
    <div className="p-4 space-y-4">
      <video
        ref={remoteVideoRef}
        autoPlay={false}
        playsInline
        muted={false}
        controls
        className="w-full max-w-2xl rounded-lg bg-black"
      />
      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">连接状态: {status}</p>
        <button
          onClick={handlePlay}
          disabled={!canPlay}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          {canPlay ? '开始播放' : '视频加载中...'}
        </button>
      </div>
    </div>
  );
}
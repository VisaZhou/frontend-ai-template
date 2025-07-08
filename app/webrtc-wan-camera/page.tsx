'use client';

import { useState, useRef, useEffect } from 'react';

export default function WebRTCPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const initWebRTC = async () => {
    if (pcRef.current) {
      console.warn('已经初始化过 WebRTC，不要重复创建');
      return;
    }

    try {
      setStatus('connecting');

      // 获取本地流
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 创建 PeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pcRef.current = peerConnection;

      // 添加本地 track
      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      // ICE candidate
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('收集到本地 ICE candidate:', event.candidate);

          fetch('http://1.95.14.168:8110/videoTest/candidate/publisher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: '1234567890',
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex
            })
          }).catch(err => console.error('发送本地 Candidate 失败:', err));
        }
      };

      // 连接状态变化
      peerConnection.onconnectionstatechange = () => {
        console.log('连接状态变更:', peerConnection.connectionState);
        if (peerConnection.connectionState === 'connected') {
          setStatus('connected');
        } else if (
          peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed'
        ) {
          setStatus('disconnected');
          // 停止轮询
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
        }
      };

      // 创建 Offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      console.log('发送 Offer 到后端...');
      const offerRes = await fetch('http://1.95.14.168:8110/videoTest/offer/publisher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: '1234567890',
          sdp: offer.sdp
        })
      });

      const { sdp: answerSDP } = await offerRes.json();

      console.log('设置远端 Answer...');
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSDP
      }));

      // 启动轮询远端 ICE Candidate
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`http://1.95.14.168:8110/videoTest/candidate/poll?sessionId=1234567890`);
          const candidates = await res.json();
          if (candidates.length > 0) {
            console.log('收到后端 ICE Candidates:', candidates);

            // 添加到 PeerConnection
            for (const c of candidates) {
              await peerConnection.addIceCandidate(new RTCIceCandidate(c));
            }

            // 有任何 candidate，就停止轮询
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              console.log('已收到候选者，停止轮询');
            }
          }
        } catch (err) {
          console.error('轮询 ICE Candidate 失败:', err);
        }
      }, 1000);

      console.log('WebRTC 初始化完成');
    } catch (err) {
      console.error('WebRTC 初始化失败:', err);
      setStatus('error');
    }
  };

  // 卸载清理
  useEffect(() => {
    return () => {
      console.log('组件卸载，清理资源');
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  return (
    <div className="p-4 space-y-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        playsInline
        className="w-full max-w-2xl mx-auto bg-gray-800 rounded-lg"
      />
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-gray-600">连接状态: {status}</span>
        <button
          onClick={initWebRTC}
          disabled={pcRef.current !== null}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          启动 WebRTC 推流
        </button>
      </div>
    </div>
  );
}
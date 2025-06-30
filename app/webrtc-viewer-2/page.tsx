'use client';

import { useEffect, useRef, useState } from 'react';

export default function ViewerPage() {
  const [status, setStatus] = useState('disconnected');
  const [canPlay, setCanPlay] = useState(false);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const initWebRTC = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      peerConnectionRef.current = pc;

      pc.onicegatheringstatechange = () => {
        console.log('ICE gathering state changed:', pc.iceGatheringState);
      };

      pc.ontrack = (event) => {
        console.log('收到远程 track:', event.track.kind);
        console.log('远端 stream:', event.streams[0]);

        const videoEl = remoteVideoRef.current;
        if (videoEl && event.streams[0]) {
          videoEl.srcObject = event.streams[0];
          videoEl.onloadedmetadata = () => {
            console.log('Metadata loaded, video ready to play');
            setCanPlay(true); // 启用播放按钮
          };
        }
      };

      pc.onicecandidate = (event) => {
        console.log('ICE candidate:', event.candidate);
        fetch('http://192.168.1.9:8000/api/signal/candidate/subscriber', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'abc1234',
            candidate: event.candidate?.candidate || null,
            sdpMid: event.candidate?.sdpMid || null,
            sdpMLineIndex: event.candidate?.sdpMLineIndex || null,
            type: 'subscriber'
          }),
          headers: { 'Content-Type': 'application/json' }
        });
      };

      pc.onconnectionstatechange = () => {
        console.log('连接状态变化:', pc.connectionState);
        setStatus(pc.connectionState);
      };

      pc.addTransceiver('video', { direction: 'recvonly' });

      const offer = await pc.createOffer();
      console.log('本地 SDP offer:', offer.sdp);
      await pc.setLocalDescription(offer);

      const offerResponse = await fetch('http://192.168.1.9:8000/api/signal/offer/subscriber', {
        method: 'POST',
        body: JSON.stringify({
          type: 'subscriber',
          sessionId: 'abc1234',
          sdp: offer.sdp
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const offerData = await offerResponse.json();
      console.log('收到服务器 Answer:', offerData.sdp);

      await pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: offerData.sdp })
      );

      console.log('已设置远端 SDP');
    } catch (error) {
      console.error('WebRTC 初始化失败:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    initWebRTC();

    return () => {
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
    };
  }, []);

  const handlePlay = () => {
    const videoEl = remoteVideoRef.current;
    if (videoEl) {
      videoEl.play().catch((err) => {
        console.error('Video play failed:', err);
      });
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
'use client';
import { useState, useRef, useEffect } from 'react';

export default function WebRTCPage() {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

  const initWebRTC = async () => {
    if (pc) {
      console.warn('已经初始化过WebRTC了，不要重复创建');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const configuration = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      };

      const peerConnection = new RTCPeerConnection(configuration);

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          fetch('http://192.168.78.102:8000/api/signal/candidate/publisher', {
            method: 'POST',
            body: JSON.stringify({
              sessionId: 'abc123',
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              type: 'publisher'
            }),
            headers: { 'Content-Type': 'application/json' }
          });
        }
      };

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
          setPc(null);
        }
      };

      // 创建 Offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const offerResponse = await fetch('http://192.168.78.102:8000/api/signal/offer/publisher', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'abc123',
          sdp: offer.sdp
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const { sdp: answerSDP } = await offerResponse.json();

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSDP })
      );

      setPc(peerConnection);
      setStatus('connecting');

    } catch (error) {
      console.error('WebRTC初始化失败:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    return () => {
      if (pc) {
        console.log('清理RTCPeerConnection...');
        pc.close();
      }
    };
  }, [pc]);

  return (
    <div className="p-4 space-y-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        className="w-full max-w-2xl mx-auto bg-gray-800 rounded-lg"
      />

      <div className="flex flex-col items-center gap-2">
        <span className="text-sm text-gray-600">
          连接状态: {status}
        </span>
        <button
          onClick={initWebRTC}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={pc !== null}
        >
          启动WebRTC推流
        </button>
      </div>
    </div>
  );
}
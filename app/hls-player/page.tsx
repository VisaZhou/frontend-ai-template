"use client";
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function HlsPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null); // 存储 HLS 实例

  const initPlayer = () => {
    // 销毁旧的 HLS 实例（如果存在）
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 创建新的 HLS 实例
    const hls = new Hls({
      enableWorker: false, // 禁用 Web Worker（某些 CORS 场景需要）
      xhrSetup: (xhr) => {
        xhr.withCredentials = false; // 不发送 Cookie
      },
    });

    hlsRef.current = hls; // 存储实例

    // 加载 HLS 流
    hls.loadSource('https://phi.zigin.net:38100/hls/sn12345.m3u8');

    // 绑定视频元素
    hls.attachMedia(videoRef.current!);

    // 自动播放（需用户交互后生效）
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoRef.current?.play().catch((e) => {
        console.error('自动播放失败:', e);
      });
    });

    // 错误处理
    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS 错误:', data);
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            alert('网络错误，请检查连接');
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError(); // 尝试恢复
            break;
          default:
            alert('播放失败: ' + data.details);
        }
      }
    });
  };

  // 初始化播放器
  useEffect(() => {
    initPlayer();
    return () => {
      // 组件卸载时销毁 HLS 实例
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="p-4">
      <video
        ref={videoRef}
        controls
        crossOrigin="anonymous" // 必须设置跨域
        className="w-full max-w-4xl rounded-lg"
      />
      <button
        onClick={initPlayer}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        重新加载
      </button>
    </div>
  );
}
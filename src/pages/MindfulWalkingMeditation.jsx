import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WaveSurfer from 'wavesurfer.js';

const MindfulWalkingMeditation = () => {
  const { type } = useParams();
  const navigate = useNavigate();
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'violet',
      progressColor: 'purple',
      cursorColor: 'navy',
      barWidth: 3,
      height: 100,
      responsive: true,
      hideScrollbar: true,
      backend: 'MediaElement',
    });

    wavesurfer.current.load(`/mindful_walking_15_min.mp3`);

    wavesurfer.current.on('ready', () => {
      wavesurfer.current.play();
      setIsPlaying(true);
    });

    wavesurfer.current.on('play', () => setIsPlaying(true));
    wavesurfer.current.on('pause', () => setIsPlaying(false));

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, []);

  const togglePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  const handleBack = () => {
    navigate('/type');
  };

  return (
    <div className="meditation-detail-page">
      <h2>{type === 'mindful-walking' ? '正念行走' : '冥想'}</h2>
      <div ref={waveformRef} style={{ width: '80%' }}></div>
      <div className="audio-player-controls">
        <button onClick={togglePlayPause} className="glass-button">
          {isPlaying ? '暂停' : '播放'}
        </button>
        <button onClick={handleBack} className="glass-button">
          返回
        </button>
      </div>
    </div>
  );
};

export default MindfulWalkingMeditation;
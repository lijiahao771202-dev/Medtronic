import React from 'react';
import { Link } from 'react-router-dom';

function Type() {
  const meditationTypes = [
    {
      name: '正念行走',
      description: '将注意力集中在行走时的身体感受和周围环境，培养专注和觉知。',
      path: '/meditation/mindful-walking',
    },
    {
      name: '正念静坐',
      description: '通过专注观察呼吸的进出，训练心神集中和觉知。',
      path: '/meditation/mindful-sitting',
    },
    {
      name: '身体扫描',
      description: '系统地将注意力带到身体的各个部位，感知身体的感受，促进放松。',
      path: '/meditation/body-scan',
    },    {
      name: 'RAIN冥想',
      description: '识别、允许、探究和滋养，处理困难情绪的有效方法。',
      path: '/meditation/rain-meditation',
    },
    {
      name: '正念静坐',
      description: '通过专注观察呼吸的进出，训练心神集中和觉知。',
      path: '/meditation/mindful-sitting',
    },
    {
      name: '3分钟呼吸空间',
      description: '一个简短的练习，帮助你在忙碌中找到片刻的宁静和专注。',
      path: '/meditation/three-minute-breathing-space',
    },
  ];

  return (
    <div className="type-page">
      <h2>冥想类型</h2>
      <div className="meditation-cards-container">
        {meditationTypes.map((type) => (
          <Link
            to={type.path}
            key={type.name}
            className="meditation-card-link"
          >
            <div className="meditation-card glass-card glass-effect">
              <h4>{type.name}</h4>
              <p>{type.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default Type;
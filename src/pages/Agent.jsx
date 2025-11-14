import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import OpenAI from 'openai';
// 已移除旧的文字逐句引导组件（NarrationPlayer），统一使用 Web Audio 精确调度的引导播放

export default function Agent() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('现在，请轻轻闭上双眼，感受身体的每一个部分。让呼吸自然而然深入，每一次吸气都带来平静，每一次呼气都带走紧张。');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [speakStatus, setSpeakStatus] = useState('');
  const useSSML = false; // 统一采用引导式播放
  const [systemPrompt, setSystemPrompt] = useState(`你是一名冥想脚本生成助手。请用中文生成适合朗读的冥想脚本，语气温柔，结构清晰，长度可供 3–6 分钟朗读。
脚本文本需内嵌以下内联指令以控制停顿与语速：
- [pause:...] 插入停顿（支持毫秒与秒，如 [pause:1500] 或 [pause:2s]）。
- [rate:...] 临时调整语速（支持百分比与倍速，如 [rate:-10%]、[rate:+5%]、[rate:0.9]）。
请合理在段落之间与关键语句后使用 [pause:...]，并在需要强调“放慢”或“略微加快”的句子前使用 [rate:...]。
要求：
1) 用自然标点组织语句；避免过度使用省略号；
2) 段落之间保持流畅，避免生硬的指令堆砌；
3) 最终只输出纯脚本文本，不要附加任何说明或标注。`);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false); // 通过按钮展开/折叠系统提示词输入
  const [chatHistory, setChatHistory] = useState([]); // 模拟与 DeepSeek 的对话上下文 {role:'user', content}
  const [chatInput, setChatInput] = useState(''); // 交互式输入框内容
  const availableVoices = [
    { name: '中文女声-晓晓', value: 'zh-CN-XiaoxiaoNeural' },
    { name: '中文男声-云扬', value: 'zh-CN-YunyangNeural' },
    { name: '英文女声-Aria', value: 'en-US-AriaNeural' },
    { name: '英文男声-Guy', value: 'en-US-GuyNeural' },
  ];
  const [voices, setVoices] = useState(availableVoices);
  const [selectedVoice, setSelectedVoice] = useState('zh-CN-XiaoxiaoNeural');
  // 不使用 SSML 的参数与停顿控制（方案 1）
  const [ratePct, setRatePct] = useState(-10); // -40 ~ +40
  const [pitchHz, setPitchHz] = useState(0);   // -6 ~ +6
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const guidedPrecise = true; // 始终启用引导模式（精确时间控制）
  const audioCtxRef = useRef(null); // Web Audio API 上下文
  const currentSourceNodeRef = useRef(null);
    const currentAudioContextRef = useRef(null);
    const activeSourcesRef = useRef([]);
  // 已移除旧的 <audio> 播放与 WebSocket 长连接引用

  // 移除原生事件绑定，改为 JSX onClick，避免在某些情况下未绑定成功导致点击无反应
  useEffect(() => {}, []);

  const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseURL: 'https://api.deepseek.com',
    dangerouslyAllowBrowser: true, // 允许在浏览器环境中运行
  });

  const playSelectedMessage = async () => {
    if (!selectedMessageContent) return;
    await speakGuided(selectedMessageContent);
  };

  // 修改 generateMeditationScript 函数以接受一个 prompt 参数
  async function generateMeditationScript(prompt = chatInput) {
    let fullResponseContent = ''; // Declare fullResponseContent here
    setLoading(true);
    setError(null);
    setGeneratedText(''); // Clear previous generated text
    setIsStreaming(true);

    try {
      // 将系统提示词与会话上下文一起发送，提升互动感
      const messages = [
        { role: "system", content: systemPrompt },
        // 如果提供了 prompt，则使用 prompt；否则使用 chatInput
        { role: 'user', content: prompt.trim() }
      ];
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages,
        stream: true,
      });

      // Add a placeholder for the assistant's streaming response
      setChatHistory(prev => [...prev, { role: 'assistant', content: '' }]);


      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponseContent += content;
        setGeneratedText(fullResponseContent); // Update generated text in real-time
        // Update the last assistant message in chatHistory with partial content
        setChatHistory(prev => {
          const newChatHistory = [...prev];
          newChatHistory[newChatHistory.length - 1].content = fullResponseContent;
          return newChatHistory;
        });
      }
    } catch (err) {
      console.error("Error generating meditation script:", err);
      setError("生成冥想脚本失败，请稍后再试。");
    } finally {
      setLoading(false);
      if (fullResponseContent) {
        speakGuided(fullResponseContent);
      }
      setIsStreaming(false);
    }
  }

  function sendChat() {
    const text = (chatInput || '').trim();
    if (!text) return;
    setChatHistory(prev => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    generateMeditationScript(); // 在发送消息后自动调用生成脚本函数
  }

  function resetChat() {
    setChatHistory([]);
  }

  // 已移除普通朗读函数：统一使用引导模式（Web Audio 精确调度）

  // —— 引导模式（精确）实现 ——
  // 标点对应的默认停顿毫秒表，可后续做成可编辑
  const defaultPauseMap = {
    '，': 350, '、': 350, '；': 350, ',': 350, ';': 350,
    '。': 700, '.': 700,
    '？': 900, '?': 900,
    '！': 900, '!': 900,
    '：': 500, ':': 500,
    '\n': 1200
  };

  // 支持内联指令：[pause:1000]、[pause:10s]、[rate:-10%] 或 [rate:0.9] 等；并合并连续停顿。
  function segmentsFromText(text, opts = {}) {
    const s = (text || '').trim();
    if (!s) return [];

    const tokens = [];
    const re = /(\[pause\s*:\s*(\d+(?:\.\d+)?)\s*(ms|s)?\s*\])|(\[rate\s*:\s*([+\-]?\d+(?:\.\d+)?)\s*(%|x)?\s*\])|([，、；,;。.!?？！：:])|(\n)|([^，、；,;。.!?？！：:\n\[]+)/gi;
    let match;
    while ((match = re.exec(s)) !== null) {
      const [full, pauseCmd, pauseNum, pauseUnit, rateCmd, rateNum, rateUnit, punct, newline, textChunk] = match;
      if (pauseCmd) {
        tokens.push({ type: 'pause_cmd', value: { num: parseFloat(pauseNum), unit: (pauseUnit || 'ms').toLowerCase() } });
      } else if (rateCmd) {
        tokens.push({ type: 'rate_cmd', value: { num: parseFloat(rateNum), unit: (rateUnit || '').toLowerCase() } });
      } else if (punct) {
        tokens.push({ type: 'punct', value: punct });
      } else if (newline) {
        tokens.push({ type: 'newline', value: '\n' });
      } else if (textChunk) {
        tokens.push({ type: 'text', value: textChunk });
      }
    }

    const segs = [];
    let currentPhrase = '';
    // 初始速率/音高来自 opts（由滑条计算）
    let currentRateStr = typeof opts.defaultRateStr === 'string' ? opts.defaultRateStr : '+0%';
    let currentPitchStr = typeof opts.defaultPitchStr === 'string' ? opts.defaultPitchStr : '+0Hz';
    const pushAudioIfNeeded = () => {
      const phrase = currentPhrase.trim();
      if (phrase) {
        segs.push({ type: 'audio', phrase, rateStr: currentRateStr, pitchStr: currentPitchStr });
        currentPhrase = '';
      }
    };
    const pushPause = (ms) => {
      const pauseMs = Math.max(0, ms | 0);
      if (pauseMs <= 0) return;
      const last = segs[segs.length - 1];
      if (last && last.type === 'pause') {
        last.pauseMs += pauseMs; // 合并相邻停顿
      } else {
        segs.push({ type: 'pause', pauseMs });
      }
    };

    for (const t of tokens) {
      if (t.type === 'text') {
        currentPhrase += t.value;
      } else if (t.type === 'rate_cmd') {
        // 变更后续短语的速率（不立即输出音频或停顿）
        // 支持 [rate:-10%]、[rate:+5%]、[rate:0.9]（ratio）或 [rate:1.1x]
        let percent;
        if (t.value.unit === '%') {
          percent = t.value.num;
        } else {
          // ratio 或无单位：按倍速转换为百分比
          const ratio = t.value.num;
          percent = (ratio - 1) * 100;
        }
        const rounded = Math.round(percent);
        currentRateStr = `${rounded >= 0 ? '+' : ''}${rounded}%`;
      } else if (t.type === 'punct') {
        // 将标点归入当前短语文本，随后依据标点表添加停顿
        currentPhrase += t.value;
        const pms = defaultPauseMap[t.value] || 0;
        pushAudioIfNeeded();
        pushPause(pms);
      } else if (t.type === 'newline') {
        pushAudioIfNeeded();
        const pms = defaultPauseMap['\n'] || 0;
        pushPause(pms);
      } else if (t.type === 'pause_cmd') {
        pushAudioIfNeeded();
        let ms = 0;
        if (t.value.unit === 's') ms = Math.round(t.value.num * 1000);
        else ms = Math.round(t.value.num); // 默认 ms
        pushPause(ms);
      }
    }
    // 收尾：如果文本以非标点结束，仍需输出音频段
    pushAudioIfNeeded();

    return segs;
  }

  function wsFetchBufferForPhrase(phrase, { voice, rateStr, pitchStr }) {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket('ws://localhost:8008');
        ws.binaryType = 'arraybuffer';
        const chunks = [];
        ws.onopen = () => {
          const payload = { text: phrase, voice, rate: rateStr, pitch: pitchStr };
          ws.send(JSON.stringify(payload));
        };
        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            chunks.push(new Uint8Array(event.data));
          }
        };
        ws.onerror = (err) => {
          reject(err);
        };
        ws.onclose = async () => {
          try {
            const total = chunks.reduce((sum, u8) => sum + u8.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const u8 of chunks) { merged.set(u8, offset); offset += u8.byteLength; }
            const arrayBuffer = merged.buffer;
            let ctx = audioCtxRef.current;
            if (!ctx) {
              ctx = new (window.AudioContext || window.webkitAudioContext)();
              audioCtxRef.current = ctx;
              currentAudioContextRef.current = ctx;
            }
            if (ctx.state === 'suspended') {
              try { await ctx.resume(); } catch {}
            }
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            resolve(audioBuffer);
          } catch (e) {
            reject(e);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  const stopSpeaking = () => {
        activeSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                console.warn("Error stopping audio source:", e);
            }
        });
        activeSourcesRef.current = [];
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.suspend();
            audioCtxRef.current = null; // 将 AudioContext 设置为 null，以便下次重新创建
        }
        setIsPlaying(false);
        setSpeakStatus('已停止');
    };

    async function speakGuided(textToSpeak) {
        // 停止所有之前播放的音频
        activeSourcesRef.current.forEach(source => {
            try {
                source.stop();
            } catch (e) {
                console.warn("Error stopping audio source:", e);
            }
        });
        activeSourcesRef.current = []; // 清空活动音频源列表

        if (!textToSpeak) {
            setError('没有可朗读的文本，请先生成或输入脚本。');
            setSpeakStatus('未朗读：无文本');
            return;
        }
        setSpeakStatus('引导模式：准备分段与排程...');
        setIsPlaying(true); // 开始播放时设置 isPlaying 为 true
        const rateStr = `${ratePct >= 0 ? '+' : ''}${Math.round(ratePct)}%`;
        const pitchStr = `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`;
        const segs = segmentsFromText(textToSpeak, { defaultRateStr: rateStr, defaultPitchStr: pitchStr });
        if (!segs.length) {
            setError('分段结果为空');
            setSpeakStatus('未朗读：分段为空');
            return;
        }

        // 初始化 AudioContext
        let ctx = audioCtxRef.current;
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            audioCtxRef.current = ctx;
        }
        if (ctx.state === 'suspended') {
            try { await ctx.resume(); } catch {}
        }

        const options = { voice: selectedVoice, rateStr, pitchStr };
        const prefetchDepth = 2;
        const buffersPromises = new Array(segs.length).fill(null);
        const startAt0 = ctx.currentTime + 0.25; // 给解码/创建节点一点准备时间
        let scheduledStart = startAt0;

        // 预启动前两个请求
        for (let i = 0, k = 0; i < segs.length && k < prefetchDepth; i++) {
            if (segs[i].type === 'audio') {
                const optI = { voice: selectedVoice, rateStr: segs[i].rateStr || rateStr, pitchStr: segs[i].pitchStr || pitchStr };
                buffersPromises[i] = wsFetchBufferForPhrase(segs[i].phrase, optI);
                k++;
            }
        }

        setSpeakStatus('引导模式：开始播放...');
        try {
            for (let i = 0; i < segs.length; i++) {
                const seg = segs[i];
                if (seg.type === 'pause') {
                    // 纯停顿：只调整排程时间，不创建音源
                    scheduledStart += (seg.pauseMs || 0) / 1000;
                    continue;
                }

                if (!buffersPromises[i]) {
                    const optI = { voice: selectedVoice, rateStr: seg.rateStr || rateStr, pitchStr: seg.pitchStr || pitchStr };
                    buffersPromises[i] = wsFetchBufferForPhrase(seg.phrase, optI);
                }
                const buffer = await buffersPromises[i];
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);
                try {
                    source.start(scheduledStart);
                } catch (e) {
                    // 如果计划时间已过，立即开始，并更新后续起点
                    source.start();
                    scheduledStart = ctx.currentTime;
                }
                activeSourcesRef.current.push(source); // 将新的音频源添加到列表中

                // 如果是最后一个音频片段，添加 onended 事件监听器
                if (i === segs.length - 1) {
                    source.onended = () => {
                        setIsPlaying(false);
                        setSpeakStatus('播放完成');
                    };
                }
                // 更新下一段的起始时间：上一段时长
                scheduledStart += buffer.duration;
                // 若下一段为停顿，则会在下一次循环叠加

                // 继续预取后面的音频段，保持最多同时 2 个进行
                let k = 0;
                for (let j = i + 1; j < segs.length && k < prefetchDepth; j++) {
                    if (segs[j].type === 'audio' && !buffersPromises[j]) {
                        const optJ = { voice: selectedVoice, rateStr: segs[j].rateStr || rateStr, pitchStr: segs[j].pitchStr || pitchStr };
                        buffersPromises[j] = wsFetchBufferForPhrase(segs[j].phrase, optJ);
                        k++;
                    }
                }
            }
            setSpeakStatus('引导模式：播放中...');
    } catch (e) {
        console.error('guided mode failed:', e);
        setError('引导模式失败：' + (e?.message || e));
        setSpeakStatus('播放失败');
        setIsPlaying(false); // 错误发生时设置 isPlaying 为 false
    }
    // finally {
    //     setIsPlaying(false);
    // }
    }

  const handleMeditationTypeSelect = (type) => {
    let prompt = "";
    switch (type) {
      case '清晨正念':
        prompt = "生成一段关于清晨正念的冥想脚本，时长10分钟，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      case '睡前正念':
        prompt = "生成一段关于睡前正念的冥想脚本，时长15分钟，帮助入睡，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      case '工作间隙正念':
        prompt = "生成一段关于工作间隙正念的冥想脚本，时长5分钟，缓解压力，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      case '情绪调节正念':
        prompt = "生成一段关于情绪调节正念的冥想脚本，时长12分钟，平复焦虑，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      case '身体扫描正念':
        prompt = "生成一段关于身体扫描正念的冥想脚本，时长16分钟，释放紧张，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      case '呼吸空间正念':
        prompt = "生成一段关于呼吸空间正念的冥想脚本，时长3分钟，重置状态，在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]。";
        break;
      default:
        prompt = "生成一段冥想脚本。";
    }
    setChatInput(prompt);
    handleSendMessage();
  };

  const handleSendMessage = async () => {
    const text = (chatInput || '').trim();
    if (!text) return;
    setChatHistory(prev => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    generateMeditationScript(); // 在发送消息后自动调用生成脚本函数
  }

  return (
    <div className="agent-page" style={{ padding: '20px' }}>
      {/* Added meditation type cards with glass morphism style */}
      <div className="meditation-cards-container backdrop-blur-lg bg-white/60 border border-white/80 rounded-xl p-6 shadow-xl grid grid-cols-3 gap-4"
        style={{
          marginBottom: '30px',
          maxWidth: '900px', // 设置最大宽度
          width: '90%', // 宽度自适应
          marginLeft: 'auto', // 居中
          marginRight: 'auto', // 居中
          marginTop: '50px' // 增加顶部外边距
        }}>
        {/* Card 1: 清晨正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/morning')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">清晨正念</h3>
          <p className="text-gray-600 text-sm mb-4">唤醒身心的10分钟晨间冥想</p>
        </div>
        
        {/* Card 2: 睡前正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/sleep')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">睡前正念</h3>
          <p className="text-gray-600 text-sm mb-4">帮助入睡的15分钟放松冥想</p>
        </div>
        
        {/* Card 3: 工作间隙正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/work-break')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">工作间隙正念</h3>
          <p className="text-gray-600 text-sm mb-4">缓解压力的5分钟快速冥想</p>
        </div>
        
        {/* Card 4: 情绪调节正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/emotion')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">情绪调节正念</h3>
          <p className="text-gray-600 text-sm mb-4">平复焦虑的12分钟情绪冥想</p>
        </div>
        
        {/* Card 5: 身体扫描正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/body-scan')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">身体扫描正念</h3>
          <p className="text-gray-600 text-sm mb-4">释放紧张的16分钟身体冥想</p>
        </div>
        
        {/* Card 6: 呼吸空间正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/breathing-space')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">呼吸空间正念</h3>
          <p className="text-gray-600 text-sm mb-4">重置状态的3分钟呼吸冥想</p>
        </div>

        {/* Card 7: 慈悲正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/loving-kindness')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">慈悲正念</h3>
          <p className="text-gray-600 text-sm mb-4">培养对他人的善意和同情心</p>
        </div>

        {/* Card 8: 感恩正念 */}
        <div
          className="meditation-card"
          onClick={() => navigate('/agent/generate/gratitude')}
        >
          <h3 className="font-bold text-lg text-gray-800 mb-2">感恩正念</h3>
          <p className="text-gray-600 text-sm mb-4">专注于生活中的美好事物</p>
        </div>
      </div>
      <div className="deepseek-generator">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => setShowSystemPrompt(s => !s)}>
            {showSystemPrompt ? '隐藏系统提示词' : '编辑系统提示词'}
          </button>
          <button className="btn-primary" onClick={() => window.location.href = '/agent/voice'}>开始语音通话</button>
        </div>
        {showSystemPrompt && (
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="设置智能体的角色和指令，例如：你是一个冥想脚本生成助手..."
          />
        )}

        <h4>与智能体对话</h4>
            <div
              className="chat-box-wrapper"
              style={{
                backdropFilter: 'blur(10px)',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '20px',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
                padding: 20,
                maxWidth: '900px',
                width: '90%',
                margin: '30px auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}>
          <div className="chat-window hide-scrollbar" style={{
            padding: 12,
            maxHeight: 300,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            borderBottom: 'none',
          }}>
            {chatHistory.length === 0 ? (
              <p style={{ margin: 0, color: '#666', textAlign: 'center', padding: '20px' }}>像聊天一样告诉智能体你的需求，例如：“生成一段关于平静呼吸的冥想脚本，并在段落间加入 [pause:2s]，在放慢处用 [rate:-10%]”。</p>
            ) : (
              chatHistory.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    // onClick={() => {
                    //   if (m.role === 'assistant') {
                    //     setSelectedMessageContent(m.content);
                    //   }
                    // }}
                    style={{
                      maxWidth: '70%',
                      padding: '10px 15px',
                      borderRadius: '20px',
                      background: m.role === 'user'
                        ? '#e0f7fa'
                        : '#f0f0f0', // 移除高亮逻辑
                      color: '#333',
                      wordBreak: 'break-word',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      cursor: 'default', // 移除点击光标
                    }}
                  >
                    {/* <span style={{ fontWeight: 600, marginRight: 6 }}>{m.role === 'user' ? '你' : '智能体'}</span> */}
                    <span>{m.content}</span>
                    {m.role === 'assistant' && !isStreaming && (
                      <button
                        onClick={() => isPlaying ? stopSpeaking() : speakGuided(m.content)}
                        style={{
                          marginLeft: '10px',
                          padding: '5px 8px',
                          borderRadius: '5px',
                          backgroundColor: isPlaying ? '#FF5722' : '#4CAF50',
                          color: 'white',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        {isPlaying ? '停止播放' : '🔊'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
            <div className="chat-input-area" style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 12px' }}>
            <textarea
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="输入消息... 按 Enter 发送"
              onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
              style={{
                flex: 1,
                resize: 'none', // Prevent manual resizing
                minHeight: '40px',
                borderRadius: '15px',
                backdropFilter: 'blur(5px)',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
                padding: '10px',
                color: '#333',
              }}
              rows={1} // Start with 1 row, will expand with content
            />
            <button className="btn-secondary" onClick={sendChat}>发送</button>
            <button className="btn-secondary" onClick={resetChat}>清空会话</button>
          </div>
        </div>
        {/* <button className="btn-primary" onClick={generateMeditationScript} disabled={loading}>
          {loading ? '生成中...' : '生成冥想脚本'}
        </button> */}
        {error && <p className="error-message">{error}</p>}
        {/* 移除朗读文本框 */}
        {/* <div className="manual-script">
          <h4>朗读文本（支持 [pause:...] 指令）:</h4>
          <textarea
            value={generatedText}
            onChange={e => setGeneratedText(e.target.value)}
            rows={8}
            placeholder="在此粘贴或输入要引导朗读的文本。例如：\n吸气……[pause:2000] 呼气……[pause:3s]\n把语速降低：[rate:-10%] 或 [rate:0.9]"
          />
          <p className="tip">你可以使用上方提示词生成脚本，或直接在此粘贴/输入并编辑要朗读的文本。</p>
        </div> */}
      </div>

      <hr />

      <h3>脚本引导</h3>
      <div className="voice-selection" style={{
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        padding: 20,
        marginTop: '30px',
        marginBottom: '20px',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '900px',
        width: '90%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '10px',
      }}>
        <label htmlFor="voice-select">选择声音：</label>
        <select id="voice-select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
          {voices.map(voice => (
            <option key={voice.value} value={voice.value}>{voice.name}</option>
          ))}
        </select>
        <span style={{ marginLeft: '12px', color: '#555' }}>引导模式（精确）已启用</span>
        <span style={{ marginLeft: '12px' }}>语速:</span>
        <input type="range" min={-40} max={40} value={ratePct} onChange={e => setRatePct(parseInt(e.target.value))} />
        <span style={{ width: 48, display: 'inline-block', textAlign: 'center' }}>{ratePct}%</span>
        <span style={{ marginLeft: '12px' }}>音高:</span>
        <input type="range" min={-6} max={6} value={pitchHz} onChange={e => setPitchHz(parseInt(e.target.value))} />
        <span style={{ width: 48, display: 'inline-block', textAlign: 'center' }}>{pitchHz}Hz</span>
        {/* 已移除 SSML 播放开关：仅保留引导模式 */}
        {/* 已移除普通朗读入口 */}
        {guidedPrecise && <button id="guided-speak-button" className="btn-secondary" onClick={speakGuided}>开始引导</button>}
        {speakStatus && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>{speakStatus}</span>}
      </div>
      {/* 已移除示例 SSML 按钮
        <button className="btn-secondary" onClick={() => {
          setUseSSML(true);
          setGeneratedText(`<speak xmlns=\"http://www.w3.org/2001/10/synthesis\" version=\"1.0\">
  <voice name=\"${selectedVoice}\">
    <prosody rate=\"+10%\" pitch=\"+2Hz\">现在，请轻轻闭上双眼，感受身体的每一个部分。</prosody>
    <break time=\"500ms\"/>
    <prosody rate=\"-10%\">让呼吸 athletically，每一次吸气都带来平静，每一次呼气都带走紧张。</prosody>
  </voice>
</speak>`);
        }}>填入示例SSML</button>
      */}
      {/* 不再展示文字逐句引导组件，统一使用上方“开始引导”按钮进行 Web Audio 精确朗读 */}
    </div>
  )
}

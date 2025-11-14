## 结论
- 目前浏览器报错是 `https://api.deepseek.com/chat/completions` 的网络/密钥问题，和本地后端无关。
- 自动播放依赖的本地 WebSocket TTS 服务 `ws://localhost:8008` 未启动，则生成后无法播放。

## 需要启动的服务
- Python TTS 服务：`server/app.py`（端口 `8008`）。依赖 `edge-tts` 等库。

## 启动步骤（Windows）
1. 安装依赖：`python -m pip install -r server/requirements.txt`
2. 启动服务：`python server/app.py`
3. 保持该终端运行，前端页面即可连到 `ws://localhost:8008`。

## 生成 API 配置（可选）
- 若仍需在线生成脚本，需在环境中设置 `VITE_OPENAI_API_KEY`，并保证外网可访问 `https://api.deepseek.com`。

## 验证
- 打开 `http://localhost:5173/agent/generate/morning`：生成期间显示加载动画；生成完成后自动播放（已连到本地 TTS）。
- 终端看到 WebSocket 的连接与音频分片日志，即服务正常。
## 变更目标

* 在后端新增一个本地HTTP代理端点，将浏览器请求转发到DeepSeek，避免CORS/网络不稳定。

* 前端通话页改为请求本地代理（非浏览器直连），保证“点击一次讲话→智能体回应”稳定。

* 不保存密钥到仓库，代理从环境变量读取。

## 后端实现

* 新增 `server/chat_proxy.py`（Flask）：

  * 端口：`8009`

  * 读取环境变量 `DEEPSEEK_API_KEY`

  * 路由：`POST /chat`，接收 `{ system, user }`，调用 `https://api.deepseek.com/v1/chat/completions`（非流式），返回 `{ content }`

  * 开启 CORS

## 前端改动

* 修改 `src/pages/VoiceCall.jsx` 的 `streamLLM(text)`：

  * 改用 `fetch('http://localhost:8009/chat', { body: { system, user } })`

  * 收到 `content` 后进行分段与排程播放，并写入文字记录

  * 保留现有指令剔除、防重复声音与暂停/挂断逻辑

## 密钥配置

* 使用系统环境变量：`DEEPSEEK_API_KEY`

* 我将为你设置本机环境变量并启动代理服务，不把密钥写入代码或提交到仓库。

## 验收

* 打开 `http://localhost:5173/agent/voice`，点击“开始讲话”→识别结束后立即得到智能体回应并播放；文字记录稳定显示

* 断网或服务异常时显示提示，但页面不会清空或闪消


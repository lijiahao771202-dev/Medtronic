import asyncio
import websockets
import edge_tts
import json
import re
import xml.etree.ElementTree as ET


def parse_ssml(ssml_text: str, default_voice: str):
    """
    解析一个简单子集的 SSML：
    - <speak> 根元素
    - <voice name="..."> 切换发音人
    - <prosody rate="..." pitch="..." volume="...">文本</prosody>
    - <break time="500ms"/> 仅作为流式暂停（不插入静音音频）

    返回一个段列表，每段为 dict：
    - {"text": "...", "voice": "...", "rate": "+10%", "pitch": "+2Hz", "volume": "+0%"}
    - 或 {"break": "500ms"}
    """
    segments = []
    try:
        root = ET.fromstring(ssml_text)
    except Exception:
        return None

    # 支持带命名空间的标签名
    def tag_name(node):
        t = node.tag
        return t.split('}')[-1].lower() if '}' in t else t.lower()

    current_voice = default_voice

    def walk(node, params):
        nonlocal current_voice
        name = tag_name(node)

        if name == 'voice':
            v = node.attrib.get('name') or node.attrib.get('voice')
            if v:
                current_voice = v
            # 处理 voice 子节点
            if node.text and node.text.strip():
                segments.append({"text": node.text.strip(), "voice": current_voice, **params})
            for child in node:
                walk(child, params)
            if node.tail and node.tail.strip():
                segments.append({"text": node.tail.strip(), "voice": current_voice, **params})
            return

        if name == 'prosody':
            new_params = dict(params)
            for k in ('rate', 'pitch', 'volume'):
                if k in node.attrib:
                    new_params[k] = node.attrib[k]
            # 读取 prosody 内的文本
            if node.text and node.text.strip():
                segments.append({"text": node.text.strip(), "voice": current_voice, **new_params})
            for child in node:
                walk(child, new_params)
            if node.tail and node.tail.strip():
                segments.append({"text": node.tail.strip(), "voice": current_voice, **params})
            return

        if name == 'break':
            t = node.attrib.get('time', '').strip()
            segments.append({"break": t})
            if node.tail and node.tail.strip():
                segments.append({"text": node.tail.strip(), "voice": current_voice, **params})
            return

        # speak 或普通元素：收集文本并遍历子节点
        if node.text and node.text.strip():
            segments.append({"text": node.text.strip(), "voice": current_voice, **params})
        for child in node:
            walk(child, params)
        if node.tail and node.tail.strip():
            segments.append({"text": node.tail.strip(), "voice": current_voice, **params})

    walk(root, {})
    return segments

async def tts_handler(websocket, path):
    print("WebSocket connection established")
    async for message in websocket:
        print(f"Received message: {message}")
        try:
            data = json.loads(message)
            text = data.get("text")
            voice = data.get("voice", "zh-CN-XiaoxiaoNeural")
            # 自动检测是否为 SSML：即使前端未传 ssml=true，只要文本含有典型 SSML 标签也按 SSML 处理
            is_ssml = bool(data.get("ssml")) or (
                isinstance(text, str) and 
                ('<' in text and '>' in text) and 
                re.search(r"<(speak|voice|prosody|break)\b", text)
            )
            rate = data.get("rate")
            pitch = data.get("pitch")
            volume = data.get("volume")

            if not text:
                continue

            if is_ssml:
                # 直接将原始 SSML 文本交给 edge-tts，让服务端引擎处理 <break>/<prosody>/<voice> 等标签，获得原生停顿与参数效果
                try:
                    communicate = edge_tts.Communicate(text, voice)
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            await websocket.send(chunk["data"])
                            print("Sent audio chunk")
                except Exception as e:
                    print(f"SSML synthesis error, fallback strip tags: {e}")
                    stripped = re.sub(r"<[^>]+>", " ", text)
                    try:
                        communicate = edge_tts.Communicate(stripped, voice)
                        async for chunk in communicate.stream():
                            if chunk["type"] == "audio":
                                await websocket.send(chunk["data"])
                                print("Sent audio chunk")
                    except Exception as e2:
                        print(f"Fallback synthesis error: {e2}")
                # 合成完成后主动关闭连接
                try:
                    await websocket.close()
                except Exception:
                    pass
            else:
                # 普通文本 + 可选参数（rate/pitch/volume）
                rate_arg = str(rate) if rate is not None else None
                pitch_arg = str(pitch) if pitch is not None else None
                volume_arg = str(volume) if volume is not None else None

                kwargs = {}
                if rate_arg is not None:
                    kwargs["rate"] = rate_arg
                if pitch_arg is not None:
                    kwargs["pitch"] = pitch_arg
                if volume_arg is not None:
                    kwargs["volume"] = volume_arg

                try:
                    communicate = edge_tts.Communicate(text, voice, **kwargs)
                    async for chunk in communicate.stream():
                        if chunk["type"] == "audio":
                            await websocket.send(chunk["data"])
                            print("Sent audio chunk")
                except Exception as e:
                    print(f"Synthesis error: {e}")
                try:
                    await websocket.close()
                except Exception:
                    pass
        except Exception as e:
            print(f"Error: {e}")
            # 确保错误情况下也关闭连接，便于前端回退播放
            try:
                await websocket.close()
            except Exception:
                pass

start_server = websockets.serve(tts_handler, "localhost", 8008)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
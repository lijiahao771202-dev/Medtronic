import os
import json
import requests
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')
DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

@app.route('/chat', methods=['POST'])
def chat():
    if not DEEPSEEK_API_KEY:
        return jsonify({'error': 'DEEPSEEK_API_KEY not set'}), 500
    data = request.get_json(force=True) or {}
    system = data.get('system') or '你是冥想语音助手，输出可包含 [pause:..] 和 [rate:..] 指令。'
    user = data.get('user') or ''
    payload = {
        'model': 'deepseek-chat',
        'stream': False,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user}
        ]
    }
    try:
        resp = requests.post(
            DEEPSEEK_URL,
            headers={
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data=json.dumps(payload),
            timeout=60
        )
        if resp.status_code != 200:
            try:
                detail = resp.text
            except Exception:
                detail = 'unknown'
            # 打印到服务端控制台，便于排查
            print(f"DeepSeek proxy error {resp.status_code}: {detail[:200]}")
            return jsonify({'error': 'deepseek_error', 'status': resp.status_code, 'detail': detail}), 502
        j = resp.json()
        content = j.get('choices', [{}])[0].get('message', {}).get('content', '')
        return jsonify({'content': content})
    except Exception as e:
        print(f"Proxy exception: {e}")
        return jsonify({'error': 'proxy_error', 'detail': str(e)}), 500

@app.route('/chat/stream', methods=['POST'])
def chat_stream():
    if not DEEPSEEK_API_KEY:
        return jsonify({'error': 'DEEPSEEK_API_KEY not set'}), 500
    data = request.get_json(force=True) or {}
    system = data.get('system') or '你是冥想语音助手，输出可包含 [pause:..] 和 [rate:..] 指令。'
    user = data.get('user') or ''
    payload = {
        'model': 'deepseek-chat',
        'stream': True,
        'messages': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user}
        ]
    }
    try:
        resp = requests.post(
            DEEPSEEK_URL,
            headers={
                'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            data=json.dumps(payload),
            timeout=60,
            stream=True
        )
        if resp.status_code != 200:
            try:
                detail = resp.text
            except Exception:
                detail = 'unknown'
            print(f"DeepSeek proxy stream error {resp.status_code}: {detail[:200]}")
            return jsonify({'error': 'deepseek_error', 'status': resp.status_code, 'detail': detail}), 502

        def event_stream():
            buf = ''
            def to_ascii_digits(s: str) -> str:
                table = {ord('０'): '0', ord('１'): '1', ord('２'): '2', ord('３'): '3', ord('４'): '4', ord('５'): '5', ord('６'): '6', ord('７'): '7', ord('８'): '8', ord('９'): '9'}
                return s.translate(table)
            def cn_num_to_arabic(s: str) -> str:
                m = {'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9}
                s = s.replace(' ', '')
                if '十' in s:
                    parts = s.split('十')
                    tens = m.get(parts[0], 1) if parts[0] != '' else 1
                    ones = m.get(parts[1], 0) if len(parts) > 1 else 0
                    return str(tens*10+ones)
                return str(m.get(s, ''))
            import re
            pat = re.compile(r"([\[\uFF3B\u3010\(\uFF08\{\uFF5B])\s*pause\s*[:\uFF1A]\s*([0-9\uFF10-\uFF19]+(?:\.[0-9\uFF10-\uFF19]+)?|[一二两三四五六七八九十]+)\s*(ms|s|秒)?\s*([\]\uFF3D\u3011\)\uFF09\}\uFF5D])", re.IGNORECASE)
            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if line.startswith('data: '):
                    payload = line[6:]
                    if payload.strip() == '[DONE]':
                        if buf.strip():
                            out = json.dumps({'type':'content','text': buf}, ensure_ascii=False)
                            yield f'data: {out}\n\n'
                            buf = ''
                        yield 'event: done\ndata: [DONE]\n\n'
                        break
                    try:
                        j = json.loads(payload)
                        choices = j.get('choices') or []
                        if choices:
                            delta = choices[0].get('delta') or {}
                            content = delta.get('content')
                            if content:
                                buf += content
                                start = 0
                                for m in pat.finditer(buf):
                                    i0, i1 = m.span()
                                    pre = buf[start:i0]
                                    if pre:
                                        out = json.dumps({'type':'content','text': pre}, ensure_ascii=False)
                                        yield f'data: {out}\n\n'
                                    raw_num = m.group(2)
                                    unit = (m.group(3) or '').lower()
                                    num_str = to_ascii_digits(raw_num)
                                    if unit == '秒' and not re.match(r"^\d", num_str):
                                        num_str = cn_num_to_arabic(raw_num)
                                    try:
                                        num = float(num_str)
                                    except Exception:
                                        num = None
                                    if num is not None and unit:
                                        ms = int(round(num*1000)) if unit in ('s','秒') else int(round(num))
                                        outp = json.dumps({'type':'pause','ms': ms}, ensure_ascii=False)
                                        yield f'data: {outp}\n\n'
                                    start = i1
                                buf = buf[start:]
                                safe_text = ''
                                if '[' not in buf and '［' not in buf and '【' not in buf and '(' not in buf and '（' not in buf and '{' not in buf and '｛' not in buf:
                                    safe_text = buf
                                    buf = ''
                                if safe_text:
                                    out = json.dumps({'type':'content','text': safe_text}, ensure_ascii=False)
                                    yield f'data: {out}\n\n'
                    except Exception:
                        yield f'data: {payload}\n\n'
        return Response(stream_with_context(event_stream()), mimetype='text/event-stream')
    except Exception as e:
        print(f"Proxy stream exception: {e}")
        return jsonify({'error': 'proxy_error', 'detail': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'ok': True, 'has_key': bool(DEEPSEEK_API_KEY)}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8009)

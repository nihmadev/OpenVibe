import os
import re
import time
from deep_translator import GoogleTranslator

i18n_dir = '/home/nihmadev/OpenVibe/src/i18n'
en_file = os.path.join(i18n_dir, 'en.ts')

lang_map = {
    'am': 'am', 'ar': 'ar', 'az': 'az', 'be': 'be', 'bg': 'bg', 
    'bn': 'bn', 'cs': 'cs', 'de': 'de', 'el': 'el', 'es': 'es', 
    'fa': 'fa', 'fil': 'tl', 'fr': 'fr', 'hi': 'hi', 'id': 'id', 
    'it': 'it', 'ja': 'ja', 'kk': 'kk', 'ko': 'ko', 'mr': 'mr', 
    'ms': 'ms', 'my': 'my', 'nl': 'nl', 'pa': 'pa', 'pl': 'pl', 
    'pt': 'pt', 'ro': 'ro', 'sr': 'sr', 'sv': 'sv', 'th': 'th', 
    'tr': 'tr', 'uk': 'uk', 'vi': 'vi', 'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW'
}

with open(en_file, 'r', encoding='utf-8') as f:
    en_content = f.read()

en_keys_values = {}
for match in re.finditer(r'^\s*([a-zA-Z0-9_]+)\s*:\s*(["\'])(.*?)\2,?', en_content, re.MULTILINE):
    en_keys_values[match.group(1)] = match.group(3)

def translate_with_retry(translator, text, max_retries=4):
    for attempt in range(max_retries):
        try:
            return translator.translate(text)
        except Exception as e:
            print(f"  [Attempt {attempt+1} failed]: {e}")
            time.sleep(2 ** attempt)
    return None

def process_file(filename, target_lang_code):
    filepath = os.path.join(i18n_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We look for lines like `key: ""` or `key: ''`
    lines = content.split('\n')
    translated_lines = []
    
    translator = GoogleTranslator(source='en', target=target_lang_code)
    
    changed = False
    for line in lines:
        match = re.match(r'^(\s*)([a-zA-Z0-9_]+)\s*:\s*(["\'])(\s*)\3(,?)$', line)
        if match:
            indent = match.group(1)
            key = match.group(2)
            quote = match.group(3)
            comma = match.group(5)
            
            eng_val = en_keys_values.get(key)
            if not eng_val:
                # If it's not in en.ts, we can't translate it
                translated_lines.append(line)
                continue
                
            print(f"[{filename}] Found empty key '{key}', translating '{eng_val}' to {target_lang_code}...")
            changed = True
            
            translated_val = translate_with_retry(translator, eng_val)
            if translated_val:
                translated_val = translated_val.replace('"', '\\"')
                translated_lines.append(f'{indent}{key}: "{translated_val}"{comma}')
            else:
                print(f"  => Failed to translate {key}, using English fallback")
                translated_lines.append(f'{indent}{key}: "{eng_val}"{comma}')
                
            time.sleep(0.1)
        else:
            translated_lines.append(line)
    
    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(translated_lines))
        print(f"Updated empty strings in {filename}\n")

for lang, code in lang_map.items():
    process_file(f"{lang}.ts", code)

print("Done fixing empty strings!")

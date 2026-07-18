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
            time.sleep(2 ** attempt) # 1s, 2s, 4s, 8s backoff
    return None

def process_file(filename, target_lang_code):
    filepath = os.path.join(i18n_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "// Auto-added translated keys" in content:
        print(f"Skipping {filename}, already translated.")
        return

    if "// Auto-added missing keys" not in content:
        print(f"No auto-added section in {filename}, skipping.")
        return

    parts = content.split("// Auto-added missing keys\n")
    original_part = parts[0]
    auto_added_part = parts[1]
    
    lines = auto_added_part.split('\n')
    translated_lines = []
    
    translator = GoogleTranslator(source='en', target=target_lang_code)
    print(f"--- Translating {filename} to {target_lang_code} ---")
    
    count_success = 0
    count_fail = 0
    
    for line in lines:
        match = re.match(r'^  ([a-zA-Z0-9_]+): (["\'])(.*?)\2,?', line)
        if match:
            key = match.group(1)
            eng_val = en_keys_values.get(key, match.group(3))
            
            translated_val = translate_with_retry(translator, eng_val)
            if translated_val:
                translated_val = translated_val.replace('"', '\\"')
                translated_lines.append(f'  {key}: "{translated_val}",')
                count_success += 1
            else:
                print(f"  => Failed to translate {key}, using English fallback")
                translated_lines.append(f'  {key}: "{eng_val}",')
                count_fail += 1
                
            time.sleep(0.1) # Small delay to be polite to the API
        else:
            if line.strip() != "};" and line.strip() != "":
                translated_lines.append(line)
    
    new_content = original_part + "// Auto-added translated keys\n" + '\n'.join(translated_lines) + "\n};\n"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Finished {filename}: {count_success} translated, {count_fail} failed\n")

for lang, code in lang_map.items():
    process_file(f"{lang}.ts", code)

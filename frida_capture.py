import frida, time, os, sys

LOG = r'D:\ReverseAPI\frida_capture.log'
SCRIPT = r'D:\ReverseAPI\eyecon_hook.js'

def on_message(message, data):
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            if message.get('type') == 'log':
                f.write(str(message.get('payload')) + '\n')
            else:
                f.write(str(message) + '\n')
            if data:
                f.write('DATA: ' + repr(data) + '\n')
            f.flush()
    except Exception as e:
        pass

with open(LOG, 'a', encoding='utf-8') as f:
    f.write('\n========== NEW CAPTURE SESSION ==========\n')

device = frida.get_usb_device()
try:
    session = device.attach('Eyecon')
    print('attached to running Eyecon', flush=True)
except Exception as e:
    print('attach failed (%s), spawning' % e, flush=True)
    pid = device.spawn(['com.eyecon.global'])
    session = device.attach(pid)
    device.resume(pid)
    print('spawned pid %d' % pid, flush=True)

with open(SCRIPT, 'r', encoding='utf-8') as f:
    src = f.read()
script = session.create_script(src, runtime='v8')
script.on('message', on_message)
script.load()
print('SCRIPT LOADED', flush=True)

while True:
    time.sleep(1)

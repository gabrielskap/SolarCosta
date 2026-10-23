import concurrent.futures
import io
import threading
import time
import unittest
import urllib.request
import urllib.error
from unittest.mock import patch
from PIL import Image
import server


class ServiceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.TOKEN = 'test-token-' + 'a'*32
        cls.http = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.http.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()

    def request(self, path, method='GET', body=None, auth=True):
        headers = {'Authorization': 'Bearer '+server.TOKEN} if auth else {}
        headers.update({'Content-Type': 'image/png', 'X-Output-Width': '8', 'X-Output-Height': '8',
                        'X-Job-Id': '12345678-1234-1234-1234-123456789012'})
        try:
            with urllib.request.urlopen(urllib.request.Request(self.url+path, data=body, headers=headers, method=method), timeout=5) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()

    def test_auth_and_bad_inputs(self):
        self.assertEqual(self.request('/health', auth=False)[0], 401)
        self.assertEqual(self.request('/upscale', 'POST', b'')[0], 422)
        self.assertEqual(self.request('/jobs/bad', 'DELETE')[0], 404)

    def test_transport_and_cancellation(self):
        class FakeProcess:
            hold = False
            def __init__(self, args, **kwargs):
                self.event = threading.Event()
                self.killed = False
                Image.new('RGB', (8, 8), '#123456').save(args[3], 'WEBP', lossless=True)
                if not self.hold:
                    self.event.set()
            def wait(self, timeout=None):
                self.event.wait(4)
                return 1 if self.killed else 0
            def poll(self):
                return (1 if self.killed else 0) if self.event.is_set() else None
            def kill(self):
                self.killed = True
                self.event.set()

        with patch.object(server.subprocess, 'Popen', FakeProcess):
            status, data = self.request('/upscale', 'POST', b'simulated-clean-background')
            self.assertEqual(status, 200)
            self.assertEqual(Image.open(io.BytesIO(data)).size, (8, 8))
            FakeProcess.hold = True
            with concurrent.futures.ThreadPoolExecutor() as executor:
                pending = executor.submit(self.request, '/upscale', 'POST', b'background')
                for _ in range(100):
                    with server.GUARD:
                        started = bool(server.JOBS)
                    if started:
                        break
                    time.sleep(0.01)
                self.assertTrue(started)
                self.assertEqual(self.request('/upscale', 'POST', b'background')[0], 429)
                self.assertEqual(self.request('/jobs/12345678-1234-1234-1234-123456789012', 'DELETE')[0], 204)
                self.assertEqual(pending.result()[0], 422)
            class TimeoutProcess(FakeProcess):
                def wait(self, timeout=None):
                    if timeout is not None:
                        raise server.subprocess.TimeoutExpired('inference', timeout)
                    return super().wait()
            with patch.object(server.subprocess, 'Popen', TimeoutProcess):
                self.assertEqual(self.request('/upscale', 'POST', b'background')[0], 504)
        for _ in range(100):
            if not server.JOBS and not server.LOCK.locked():
                break
            time.sleep(0.01)
        self.assertFalse(server.JOBS)
        self.assertTrue(server.LOCK.acquire(False))
        server.LOCK.release()


if __name__ == '__main__':
    unittest.main()

from trusted_client import client_ip
checks = 0

def good(peer, forwarded, expected, trusted=('10.0.0.0/8',)):
    global checks
    assert client_ip(peer, forwarded, trusted) == expected
    checks += 1

def bad(peer, forwarded, trusted=('10.0.0.0/8',)):
    global checks
    try:
        client_ip(peer, forwarded, trusted)
    except ValueError:
        checks += 1
        return
    raise AssertionError('expected rejected forwarding data')

good('198.51.100.2', '1.1.1.1', '198.51.100.2')
good('10.0.0.1', '192.0.2.4, 10.0.0.2', '192.0.2.4')
good('10.0.0.1', '1.1.1.1, 192.0.2.4', '192.0.2.4')
good('::ffff:10.0.0.1', '::ffff:192.0.2.4', '192.0.2.4')
good('10.0.0.1', None, '10.0.0.1')
bad('10.0.0.1', '10.0.0.2')
bad('10.0.0.1', '192.0.2.4,')
bad('10.0.0.1', 'not-an-ip')
bad('10.0.0.1', 'fe80::1%eth0')
bad('10.0.0.1', ','.join(['192.0.2.4'] * 17))
print(f'trusted client IP: {checks} checks passed; pure policy only')

"""Strict X-Forwarded-For policy core; no Django or Nginx integration."""
from ipaddress import ip_address, ip_network


def address(raw):
    if not isinstance(raw, str) or '%' in raw:
        raise ValueError('literal IP required, no scoped IPv6')
    ip = ip_address(raw.strip())
    return ip.ipv4_mapped if ip.version == 6 and ip.ipv4_mapped else ip


def client_ip(peer, forwarded, trusted_cidrs):
    peer_ip = address(peer)
    if len(trusted_cidrs) > 32:
        raise ValueError('trust-list bound')
    networks = [ip_network(x, strict=True) for x in trusted_cidrs]
    def trusted(ip):
        return any(ip.version == n.version and ip in n for n in networks)
    # A direct untrusted peer cannot supply authoritative forwarding headers.
    if not trusted(peer_ip) or forwarded is None:
        return str(peer_ip)
    if not isinstance(forwarded, str) or len(forwarded) > 4096:
        raise ValueError('header bound')
    parts = forwarded.split(',')
    if not 1 <= len(parts) <= 16 or any(not x.strip() for x in parts):
        raise ValueError('hop bound or empty hop')
    chain = [address(x) for x in parts] + [peer_ip]
    # Strip only verified infrastructure from the right; never select leftmost blindly.
    for ip in reversed(chain):
        if not trusted(ip):
            return str(ip)
    # No independently attributable client before the trusted infrastructure.
    raise ValueError('all hops trusted; client attribution ambiguous')

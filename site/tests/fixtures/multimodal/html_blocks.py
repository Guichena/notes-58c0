from html.parser import HTMLParser
from hashlib import sha256


def digest(value):
    return sha256(value.encode('utf-8')).hexdigest()


class TopLevelBlocks(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=False)
        self.raw = raw
        self.line_offsets = [0]
        for line in raw.splitlines(keepends=True):
            self.line_offsets.append(self.line_offsets[-1] + len(line))
        self.depth = 0
        self.start = None
        self.tag = None
        self.blocks = []
        self.feed(raw)
        self.close()
        assert self.depth == 0, 'Unbalanced HTML'
        assert ''.join(x['html'] for x in self.blocks) == raw, 'Unmapped HTML text'

    def position(self):
        row, col = self.getpos()
        return self.line_offsets[row - 1] + col

    def handle_starttag(self, tag, attrs):
        if self.depth == 0:
            self.start, self.tag = self.position(), tag
        if tag not in {'br','hr','img','input','meta','link','source','wbr'}:
            self.depth += 1
        elif self.depth == 0:
            self.emit(self.position() + len(self.get_starttag_text()))

    def handle_endtag(self, tag):
        self.depth -= 1
        assert self.depth >= 0
        if self.depth == 0:
            self.emit(self.raw.index('>', self.position()) + 1)

    def emit(self, end):
        raw = self.raw[self.start:end]
        self.blocks.append({'ordinal': len(self.blocks), 'tag': self.tag, 'html': raw, 'sha256': digest(raw)})

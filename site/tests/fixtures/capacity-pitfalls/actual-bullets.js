const bullets = (items, ordered) => (items && items.length) ? `<${ordered ? 'ol' : 'ul'} class="bullets">${items.map((x) => `<li>${h(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>` : '';

const wrappers = [];

function enhanceSelects() {
  document.querySelectorAll('#panel select').forEach(select => {
    if (select.closest('.custom-select')) return;

    const display = document.createElement('div');
    display.className = 'cs-value';

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 10 6');
    arrow.setAttribute('class', 'cs-arrow');
    arrow.innerHTML = '<path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" stroke-width="1.5"/>';

    const options = document.createElement('div');
    options.className = 'cs-options';

    const csOptions = [];
    const updateDisplay = () => {
      const opt = select.options[select.selectedIndex];
      display.textContent = opt ? opt.textContent : '';
      const val = select.value;
      for (const o of csOptions) {
        o.classList.toggle('selected', o.dataset.value === val);
      }
    };

    for (const opt of select.options) {
      const div = document.createElement('div');
      div.className = 'cs-option';
      if (opt.selected) div.classList.add('selected');
      div.textContent = opt.textContent;
      div.dataset.value = opt.value;
      options.appendChild(div);
      csOptions.push(div);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(display);
    wrapper.appendChild(arrow);
    wrapper.appendChild(select);
    wrapper.appendChild(options);
    select.style.display = 'none';
    wrappers.push(wrapper);

    updateDisplay();
    select.addEventListener('change', updateDisplay);

    wrapper.addEventListener('click', e => {
      if (e.target.closest('.cs-options')) return;
      wrapper.classList.toggle('open');
    });

    options.addEventListener('click', e => {
      const opt = e.target.closest('.cs-option');
      if (!opt) return;
      select.value = opt.dataset.value;
      select.dispatchEvent(new Event('change'));
      wrapper.classList.remove('open');
    });
  });
}

document.addEventListener('click', e => {
  for (const w of wrappers) {
    if (!w.contains(e.target)) w.classList.remove('open');
  }
});

enhanceSelects();

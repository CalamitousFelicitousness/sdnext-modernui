async function setupMPTabObservers() {
  // Handle Mode dropdown disabled state when MP tab is selected
  // MP resize doesn't use Mode (Fixed/Crop/Fill/etc), only Method (upscaler) applies

  const tabGroups = [
    { prefix: 'control_before', modeId: 'control_before_resize_mode', hasCustomButtons: true },
    { prefix: 'control_after', modeId: 'control_after_resize_mode', hasCustomButtons: true },
    { prefix: 'control_mask', modeId: 'control_mask_resize_mode', hasCustomButtons: true },
    { prefix: 'img2img', modeId: 'img2img_resize_mode', hasCustomButtons: false },
  ];

  tabGroups.forEach(({ prefix, modeId, hasCustomButtons }) => {
    // Guard key - only set after successful initialization
    const guardKey = `mpObserverInit${prefix.replace(/_/g, '')}`;
    if (document.body.dataset[guardKey]) return;

    // Find the Gradio tabs container and buttons
    const gradioTabsContainer = document.getElementById(`${prefix}_scale_tabs`);
    const gradioTabNav = gradioTabsContainer?.querySelector('.tab-nav');
    const gradioTabButtons = gradioTabNav ? Array.from(gradioTabNav.querySelectorAll('button')) : [];

    // Use content-based selection instead of index-based
    const gradioFixedTab = gradioTabButtons.find((btn) => btn.textContent?.trim() === 'Fixed');
    const gradioScaleTab = gradioTabButtons.find((btn) => btn.textContent?.trim() === 'Scale');
    const gradioMpTab = gradioTabButtons.find((btn) => btn.textContent?.trim() === 'MP');

    // Find the Mode dropdown container (Gradio wraps dropdowns in a div)
    const modeDropdown = document.getElementById(modeId);
    const modeContainer = modeDropdown?.closest('.gradio-dropdown, .wrap');

    // Early exit if required elements not found - don't set guard so we can retry
    if (!modeContainer || !gradioMpTab) return;

    // Click blocker function
    const blockClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    };

    function enableMode() {
      modeContainer.style.opacity = '';
      modeContainer.removeEventListener('click', blockClick, true);
      modeContainer.removeEventListener('mousedown', blockClick, true);
    }

    function disableMode() {
      modeContainer.style.opacity = '0.5';
      modeContainer.addEventListener('click', blockClick, true);
      modeContainer.addEventListener('mousedown', blockClick, true);
    }

    if (hasCustomButtons) {
      // Control tabs: Modern UI has custom tab buttons that need to sync with Gradio
      const fixedBtn = document.querySelector(`[tabitemid="#${prefix}_scale_to_tabitem"]`);
      const scaleBtn = document.querySelector(`[tabitemid="#${prefix}_scale_by_tabitem"]`);
      const mpBtn = document.querySelector(`[tabitemid="#${prefix}_scale_mp_tabitem"]`);

      // Don't set guard if custom buttons not found - can retry later
      if (!mpBtn) return;

      if (fixedBtn) {
        fixedBtn.addEventListener('click', () => {
          enableMode();
          if (gradioFixedTab) gradioFixedTab.click();
        });
      }
      if (scaleBtn) {
        scaleBtn.addEventListener('click', () => {
          enableMode();
          if (gradioScaleTab) gradioScaleTab.click();
        });
      }
      mpBtn.addEventListener('click', () => {
        disableMode();
        if (gradioMpTab) gradioMpTab.click();
      });

      // Check initial state - if Modern UI MP tab is active
      if (mpBtn.classList.contains('active')) {
        disableMode();
        if (gradioMpTab) gradioMpTab.click();
      }
    } else {
      // img2img: Uses Gradio tabs directly via portals (no custom Modern UI buttons)
      // Use event delegation on tab-nav to handle Gradio potentially re-rendering buttons
      gradioTabNav.addEventListener('click', (e) => {
        const clickedBtn = e.target.closest('button');
        if (!clickedBtn) return;

        const btnText = clickedBtn.textContent?.trim();
        if (btnText === 'MP') {
          disableMode();
        } else if (btnText === 'Fixed' || btnText === 'Scale') {
          enableMode();
        }
      });

      // Check initial state - if Gradio MP tab is selected
      const currentlySelectedTab = gradioTabNav.querySelector('button.selected');
      if (currentlySelectedTab?.textContent?.trim() === 'MP') {
        disableMode();
      }
    }

    // Mark as initialized only after successful setup
    document.body.dataset[guardKey] = 'true';
  });
}

async function setupControlDynamicObservers() {
  const dynamicInput = document.getElementById('control_dynamic_input');
  const dynamicInit = document.getElementById('control_dynamic_init');
  const dynamicControl = document.getElementById('control_dynamic_control');

  const qInputCtrl = '#control-template-column-input, #control_params_mask, #control_dynamic_resize';
  const qInputBtn = '[tabitemid="#control_resize_mask_tabitem"], [tabitemid="#control_before_scale_by_tabitem"], [tabitemid="#control_before_scale_to_tabitem"], [tabitemid="#control_before_scale_mp_tabitem"]';
  const inputElems = document.querySelectorAll(`${qInputCtrl}, ${qInputBtn}`);
  const initElems = document.querySelectorAll('#control-template-column-init');
  const controlElems = document.querySelectorAll('#control-template-column-preview');

  function setupDynamicListener(dynamic, elems, storedKey) {
    function toggleDynamicElements(dynamicEl) {
      elems.forEach((elem) => {
        if (dynamicEl.checked) elem.classList.remove('hidden');
        else elem.classList.add('hidden');
      });
    }

    if (!dynamic) return;
    dynamic.addEventListener('click', () => {
      setStored(storedKey, dynamic.checked);
      toggleDynamicElements(dynamic, elems);
    });
    dynamic.checked = getStored(storedKey) || false;
    toggleDynamicElements(dynamic, elems);
  }

  setupDynamicListener(dynamicInput, inputElems, 'control-dynamic-input');
  setupDynamicListener(dynamicInit, initElems, 'control-dynamic-init');
  setupDynamicListener(dynamicControl, controlElems, 'control-dynamic-control');
}

async function setupGenerateObservers() {
  function addButtonIcon(button, iconClass) {
    const icon = document.createElement('div');
    icon.classList.add('mask-icon', iconClass);
    button.appendChild(icon);
  }

  function addButtonSpan(button, spanText) {
    const span = document.createElement('span');
    span.textContent = spanText;
    if (!spanText) span.style.display = 'none';
    button.appendChild(span);
  }

  function enableButtonAnimation(parentButton, enable) {
    if (!parentButton) return;
    if (enable) parentButton.classList.add('active');
    else parentButton.classList.remove('active');
  }

  const keys = ['#txt2img', '#img2img', '#extras', '#control', '#video'];
  keys.forEach((key) => {
    const loop = document.querySelector(`${key}_loop`);
    if (loop) loop.addEventListener('click', () => generateForever(`${key}_generate`));

    const tgb = document.querySelector(`${key}_generate`);
    if (tgb) {
      const tg = tgb.closest('.sd-button');

      new MutationObserver(() => {
        if (tgb.textContent && !tgb.querySelector('span')) {
          if (tgb.textContent === 'Generate') {
            enableButtonAnimation(tg, false);
            addButtonIcon(tgb, 'icon-generate');
          } else {
            enableButtonAnimation(tg, true);
          }
          addButtonSpan(tgb, tgb.textContent);
        }
      }).observe(tgb, { childList: true, subtree: true });
    }

    const teb = document.querySelector(`${key}_enqueue`);
    if (teb) {
      const te = teb.closest('.sd-button');

      new MutationObserver(() => {
        if (teb.textContent && !teb.querySelector('span')) {
          if (teb.textContent === 'Enqueue') {
            enableButtonAnimation(te, false);
            addButtonIcon(teb, 'icon-enqueue');
          } else {
            enableButtonAnimation(te, true);
          }
          addButtonSpan(teb, '');
        }
      }).observe(teb, { childList: true, subtree: true });
    }

    const tpb = document.querySelector(`${key}_pause`);
    if (tpb) {
      new MutationObserver(() => {
        if (tpb.textContent && !tpb.querySelector('span')) {
          if (tpb.textContent === 'Pause') addButtonIcon(tpb, 'icon-pause');
          else addButtonIcon(tpb, 'icon-play');
          addButtonSpan(tpb, '');
        }
      }).observe(tpb, { childList: true, subtree: true });
    }
  });

  // Caption button observer (separate handling due to different ID pattern)
  const captionBtn = document.querySelector('#btn_vlm_caption');
  if (captionBtn) {
    const captionButton = captionBtn.closest('.sd-button');

    new MutationObserver(() => {
      if (captionBtn.textContent && !captionBtn.querySelector('span')) {
        if (captionBtn.textContent === 'Caption') {
          enableButtonAnimation(captionButton, false);
          addButtonIcon(captionBtn, 'icon-caption');
        } else {
          enableButtonAnimation(captionButton, true);
        }
        addButtonSpan(captionBtn, captionBtn.textContent);
      }
    }).observe(captionBtn, { childList: true, subtree: true });
  }
}

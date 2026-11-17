/**
 * Kora Documentation Platform — Code Snippet Interactivity & Copy Button
 */

document.addEventListener('DOMContentLoaded', () => {
  const codeBlocks = document.querySelectorAll('.code-block');

  codeBlocks.forEach(block => {
    const copyBtn = block.querySelector('.copy-btn');
    const codeEl = block.querySelector('pre code');

    if (copyBtn && codeEl) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(codeEl.innerText);
          const originalText = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span style="color: #10b981;">Copied!</span>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = originalText;
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code: ', err);
        }
      });
    }
  });
});

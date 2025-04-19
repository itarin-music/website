// Select all h3 elements
const h3Elements = document.querySelectorAll('h3');

// Apply scrolling on overflow
h3Elements.forEach(h3 => {
  function checkOverflow() {
    if (h3.scrollWidth > h3.clientWidth) {
      // If the content is overflowing, add the class for scrolling
      h3.classList.add('overflowing');
    } else {
      // If not overflowing, remove the scrolling class
      h3.classList.remove('overflowing');
    }
  }

  // Run the check initially
  checkOverflow();

  // Re-run the check when resizing the window
  window.addEventListener('resize', checkOverflow);
});

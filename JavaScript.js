window.addEventListener('DOMContentLoaded', () => {
  const musicWrapper = document.querySelector('.music-scroll-wrapper');
  const trackList = document.querySelector('.track-list');

  // Clone the track list and append it to the wrapper
  const clone = trackList.cloneNode(true);
  musicWrapper.appendChild(clone);

  // Calculate the total width of the content (original + clone)
  const trackWidth = trackList.offsetWidth;
  const totalWidth = trackWidth * 2; // Original + clone

  // Set the wrapper width to fit both lists
  musicWrapper.style.width = `${totalWidth}px`;

  // Set the animation duration dynamically based on total width
  const scrollSpeed = 50; // Pixels per second
  const animationDuration = totalWidth / scrollSpeed;

  // Apply the calculated duration to the animation
  musicWrapper.style.animationDuration = `${animationDuration}s`;
});
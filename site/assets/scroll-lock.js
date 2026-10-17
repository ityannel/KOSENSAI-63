let n = 0;

export const lockScroll = () => {
  if (n++ === 0) document.documentElement.classList.add("dt-open");
};

export const unlockScroll = () => {
  n = Math.max(0, n - 1);
  if (n === 0) document.documentElement.classList.remove("dt-open");
};

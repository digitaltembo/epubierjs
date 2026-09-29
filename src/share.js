/** Copy text to the clipboard; resolves to whether it worked */
export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (e) {
    // The Clipboard API needs a secure context; fall back to a selection copy
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.cssText = "position: fixed; opacity: 0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (e) {}
    area.remove();
    return copied;
  }
}

/**
 * Share a link. On phones and tablets this opens the system share sheet
 * (which can also copy); elsewhere it copies the link to the clipboard.
 *
 * @param {{title: string, text?: string, url: string}} data
 * @param {(message: string) => void} notify Shows a short message
 */
export async function shareLink(data, notify) {
  if (
    navigator.share &&
    matchMedia("(pointer: coarse)").matches &&
    (!navigator.canShare || navigator.canShare(data))
  ) {
    try {
      await navigator.share(data);
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // closed the share sheet
    }
  }
  notify((await copyText(data.url)) ? "Link copied" : "Couldn't copy the link");
}

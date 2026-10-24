/** A book's contents: `input` itself, or fetched from it when it's a URL */
export async function bookBytes(input) {
  if (typeof input !== "string") return input;
  const response = await fetch(input);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.arrayBuffer();
}

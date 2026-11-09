const form = document.querySelector("#login-form");
const message = document.querySelector("#message");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) { message.textContent = result.message; return; }
    window.location.href = "/";
  } catch {
    message.textContent = "Không kết nối được máy chủ";
  } finally { button.disabled = false; }
});

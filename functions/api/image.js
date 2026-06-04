const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const responseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...responseHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function parseImageUrl(request) {
  const requestUrl = new URL(request.url);
  const rawUrl = requestUrl.searchParams.get("url");
  if (!rawUrl) {
    throw new Error("缺少 url 参数。");
  }

  const imageUrl = new URL(rawUrl);
  if (imageUrl.protocol !== "http:" && imageUrl.protocol !== "https:") {
    throw new Error("只支持 http 或 https 图片地址。");
  }

  return imageUrl;
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: responseHeaders,
  });
}

export async function onRequestGet({ request }) {
  let imageUrl;
  try {
    imageUrl = parseImageUrl(request);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "URL 参数无效。");
  }

  let upstream;
  try {
    upstream = await fetch(imageUrl.toString(), {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/*,*/*;q=0.8",
      },
    });
  } catch {
    return jsonError("远程图片请求失败。", 502);
  }

  if (!upstream.ok) {
    return jsonError(`远程图片返回 ${upstream.status}。`, 502);
  }

  const contentType = upstream.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    return jsonError("这个 URL 返回的不是图片。", 415);
  }

  const contentLength = Number(upstream.headers.get("Content-Length") || "0");
  if (contentLength > MAX_IMAGE_BYTES) {
    return jsonError("图片超过 10MB，首版暂不处理过大的图片。", 413);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...responseHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}

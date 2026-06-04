import { encode } from "blurhash";
import { Check, Clipboard, Copy, ImageIcon, Loader2 } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useMemo, useState } from "react";
import logo from "./logo.png";

const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;
const MAX_CANVAS_SIZE = 512;

type Status = "idle" | "loading" | "success" | "error";

type ImageMeta = {
  url: string;
  width: number;
  height: number;
  fileName: string;
};

function normalizeImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请先输入图片 URL。");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL 格式不正确，请输入完整的 http 或 https 地址。");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("只支持 http 或 https 图片地址。");
  }

  return parsed.toString();
}

function getProxyUrl(imageUrl: string) {
  return `/api/image?url=${encodeURIComponent(imageUrl)}`;
}

function getScaledSize(width: number, height: number) {
  const scale = Math.min(1, MAX_CANVAS_SIZE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getFileName(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    return lastSegment ? decodeURIComponent(lastSegment) : "image";
  } catch {
    return "image";
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请确认地址可以公开访问。"));
    image.src = src;
  });
}

async function loadImageMetaAndBlurHash(imageUrl: string) {
  const image = await loadImage(getProxyUrl(imageUrl));
  const canvas = document.createElement("canvas");
  const size = getScaledSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("当前浏览器不支持 canvas，无法生成 BlurHash。");
  }

  context.drawImage(image, 0, 0, size.width, size.height);
  const imageData = context.getImageData(0, 0, size.width, size.height);

  const blurhash = encode(
    imageData.data,
    size.width,
    size.height,
    BLURHASH_COMPONENT_X,
    BLURHASH_COMPONENT_Y,
  );

  return {
    blurhash,
    meta: {
      url: imageUrl,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      fileName: getFileName(imageUrl),
    },
  };
}

function buildMarkdownSnippet(meta: ImageMeta, blurhash: string) {
  const fragment = `#blurhash=${encodeURIComponent(blurhash)}&width=${meta.width}&height=${meta.height}`;
  return `![${meta.fileName}](${meta.url}${fragment})`;
}

function buildFragmentUrl(meta: ImageMeta, blurhash: string) {
  return `${meta.url}#blurhash=${encodeURIComponent(blurhash)}&width=${meta.width}&height=${meta.height}`;
}

function extractImageUrlFromText(value: string) {
  const match = value.match(/https?:\/\/[^\s)\]]+/i);
  return match ? match[0] : "";
}

export default function App() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [blurhash, setBlurhash] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<ImageMeta | null>(null);
  const [error, setError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [copiedFragment, setCopiedFragment] = useState(false);

  const proxyPreviewUrl = useMemo(() => {
    return previewUrl ? getProxyUrl(previewUrl) : "";
  }, [previewUrl]);

  const markdownSnippet = useMemo(() => {
    if (!imageMeta || !blurhash) {
      return "";
    }

    return buildMarkdownSnippet(imageMeta, blurhash);
  }, [imageMeta, blurhash]);

  const fragmentUrl = useMemo(() => {
    if (!imageMeta || !blurhash) {
      return "";
    }

    return buildFragmentUrl(imageMeta, blurhash);
  }, [imageMeta, blurhash]);

  async function generateFromInput(imageUrl: string) {
    setStatus("loading");
    setError("");
    setCopyError("");
    setBlurhash("");
    setCopied(false);
    setCopiedMarkdown(false);
    setCopiedFragment(false);

    try {
      const normalizedUrl = normalizeImageUrl(imageUrl);
      const { blurhash: result, meta } = await loadImageMetaAndBlurHash(normalizedUrl);
      setPreviewUrl(normalizedUrl);
      setImageMeta(meta);
      setBlurhash(result);
      setStatus("success");
    } catch (error) {
      setPreviewUrl("");
      setImageMeta(null);
      setStatus("error");
      setError(error instanceof Error ? error.message : "生成失败，请稍后再试。");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await generateFromInput(url);
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedText = event.clipboardData.getData("text");
    const extractedUrl = extractImageUrlFromText(pastedText);
    if (!extractedUrl) {
      return;
    }

    event.preventDefault();
    setUrl(extractedUrl);
    void generateFromInput(extractedUrl);
  }

  async function handleCopy() {
    if (!blurhash) {
      return;
    }

    try {
      await navigator.clipboard.writeText(blurhash);
      setCopied(true);
      setCopyError("");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError("复制失败，请手动选中结果复制。");
    }
  }

  async function handleCopyMarkdown() {
    if (!markdownSnippet) {
      return;
    }

    try {
      await navigator.clipboard.writeText(markdownSnippet);
      setCopiedMarkdown(true);
      window.setTimeout(() => setCopiedMarkdown(false), 1800);
      setCopyError("");
    } catch {
      setCopiedMarkdown(false);
      setCopyError("复制 Markdown 失败，请手动复制下方内容。");
    }
  }

  async function handleCopyFragment() {
    if (!fragmentUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(fragmentUrl);
      setCopiedFragment(true);
      window.setTimeout(() => setCopiedFragment(false), 1800);
      setCopyError("");
    } catch {
      setCopiedFragment(false);
      setCopyError("复制 Fragment 失败，请手动复制下方内容。");
    }
  }

  return (
    <main className="page-shell">
      <section className="tool-panel" aria-labelledby="page-title">
        <div className="title-block">
          <img className="brand-logo" src={logo} alt="" aria-hidden="true" />
          <div>
            <p className="eyebrow">URL to BlurHash</p>
            <h1 id="page-title">图片 URL 转 BlurHash</h1>
            <p className="title-copy">适合博客图床图片的 BlurHash 生成和 Markdown 直出。</p>
          </div>
        </div>

        <form className="url-form" onSubmit={handleSubmit}>
          <label htmlFor="image-url">图片地址</label>
          <div className="input-row">
            <input
              id="image-url"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="https://example.com/image.jpg"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onPaste={handlePaste}
              disabled={status === "loading"}
            />
            <button className="primary-button" type="submit" disabled={status === "loading"}>
              {status === "loading" ? <Loader2 className="spin" size={20} /> : <ImageIcon size={20} />}
              <span>{status === "loading" ? "生成中" : "生成"}</span>
            </button>
          </div>
          <p className="helper-text">可直接粘贴图片链接、Markdown 图片或带 #blurhash 的链接。</p>
        </form>

        {status === "error" && <p className="notice error">{error}</p>}

        {status === "success" && (
          <div className="result-grid">
            <div className="preview-area">
              <img src={proxyPreviewUrl} alt="图片预览" />
            </div>

            <div className="result-area">
              {imageMeta && (
                <div className="meta-row" aria-label="图片信息">
                  <span className="meta-chip">
                    {imageMeta.width} × {imageMeta.height}
                  </span>
                  <span className="meta-chip">{imageMeta.fileName}</span>
                </div>
              )}

              {markdownSnippet && (
                <div className="markdown-block">
                  <div className="result-heading">
                    <span>Markdown 图片</span>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={handleCopyMarkdown}
                      aria-label="复制 Markdown 图片"
                    >
                      {copiedMarkdown ? <Check size={20} /> : <Copy size={20} />}
                    </button>
                  </div>
                  <output className="hash-output">{markdownSnippet}</output>
                  {copiedMarkdown && <p className="notice success">Markdown 已复制。</p>}
                </div>
              )}

              {fragmentUrl && (
                <div className="markdown-block">
                  <div className="result-heading">
                    <span>Fragment URL</span>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={handleCopyFragment}
                      aria-label="复制 Fragment URL"
                    >
                      {copiedFragment ? <Check size={20} /> : <Clipboard size={20} />}
                    </button>
                  </div>
                  <output className="hash-output">{fragmentUrl}</output>
                  {copiedFragment && <p className="notice success">Fragment 已复制。</p>}
                </div>
              )}

              <div className="result-heading">
                <span>BlurHash</span>
                <button className="icon-button" type="button" onClick={handleCopy} aria-label="复制 BlurHash">
                  {copied ? <Check size={20} /> : <Clipboard size={20} />}
                </button>
              </div>
              <output className="hash-output">{blurhash}</output>
              {copied && <p className="notice success">已复制到剪贴板。</p>}

              {copyError && <p className="notice error">{copyError}</p>}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

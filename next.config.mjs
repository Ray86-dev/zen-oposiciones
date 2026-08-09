const repo = "zen-oposiciones";
const enPages = process.env.GITHUB_ACTIONS === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages sirve archivos estáticos desde un subdirectorio.
  output: "export",
  basePath: enPages ? `/${repo}` : "",
  assetPrefix: enPages ? `/${repo}/` : "",
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: enPages ? `/${repo}` : "" },
};

export default nextConfig;

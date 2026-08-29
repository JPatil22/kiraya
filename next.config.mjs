/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Photo uploads go through a Server Action, and a listing photo may be up
      // to MAX_PHOTO_BYTES (5 MB) — plus its feed thumbnail and form overhead.
      // The default 1 MB limit 413s anything larger (e.g. an un-downscaled PNG
      // screenshot), so lift it to comfortably clear a max-size photo.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;

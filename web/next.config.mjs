/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@git-chord/gui-core"],
    webpack(config) {
        config.resolve.alias = {
            ...config.resolve.alias,
            "@remix-run/router": new URL("./node_modules/@remix-run/router", import.meta.url).pathname,
            "react-router": new URL("./node_modules/react-router", import.meta.url).pathname,
            "react-router-dom": new URL("./node_modules/react-router-dom", import.meta.url).pathname,
        };
        return config;
    },
};

export default nextConfig;

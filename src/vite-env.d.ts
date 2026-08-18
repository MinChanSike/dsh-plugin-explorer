/// <reference types="vite/client" />

declare const __APP_BUILD_DATE__: string;

declare module "*.css" {
  const content: { [className: string]: string };
  export default content;
}

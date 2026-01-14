/// <reference types="vite/client" />

// Worker module declarations for Vite
declare module '*?worker' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}

declare module '*?worker&inline' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}

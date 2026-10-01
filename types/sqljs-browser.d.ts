declare module 'sql.js/dist/sql-wasm-browser.js' {
  import initSqlJs from 'sql.js';
  export default initSqlJs;
}

declare module 'sql.js/dist/sql-wasm-browser.wasm' {
  /** Metro asset module id. */
  const asset: number;
  export default asset;
}

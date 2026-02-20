declare module "dbscanjs" {
  function dbscan<T>(
    data: T[],
    distance: (a: T, b: T) => number,
    epsilon: number,
    minPts: number
  ): number[];
  export = dbscan;
}

export interface Point {
    X: number;
    Y: number;
}

export interface Size {
    width: number;
    height: number;
}


export type Position = number[]
export type Polygon = Position[][]
export type MultiPolygon = Position[][][]
export type Geometry = Polygon | MultiPolygon
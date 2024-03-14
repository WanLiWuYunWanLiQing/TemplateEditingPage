import { Point, Polygon, MultiPolygon, Position, Geometry } from '../../Common/models';
import * as martinez from 'martinez-polygon-clipping';


/**
 * 把pathData解析成多边形点集
 * @param pathData 形如：'M0,0 L100,0 L100,100 L0,100 Z M100,50 L150,0 L150,50 Z' || 'M0,0 L100,0 L100,100 L0,100Z'
 * @returns [ [[0,0],[100,0],[100,100],[0,100],[0,0] ], [[100,50],[150,0],[150,50],[100,50]] ] || [ [0,0],[100,0],[100,100],[0,100],[0,0] ]
 */
export function parsePathDataToPolygon(pathData: string): Polygon {
    const commands = pathData.match(/[a-df-zA-DF-Z][^a-df-zA-DF-Z]*/g);
    if (!commands) return [];

    const currentPolygon: Polygon = [];

    let currentPosition: Position = [0, 0];
    let polygonIndex = 0;

    for (const command of commands) {
        const params = command.slice(1).trim().split(/[\s,]+/).map(parseFloat);
        const commandLetter = command.charAt(0).toUpperCase();

        switch (commandLetter) {
            case 'M':
                currentPolygon[polygonIndex] = [];
                currentPosition = [params[0], params[1]];
                currentPolygon[polygonIndex].push(currentPosition);
                break;
            case 'L':
                currentPosition = [params[0], params[1]];
                currentPolygon[polygonIndex].push(currentPosition);
                break;
            case 'Z':
                currentPolygon[polygonIndex].push(currentPolygon[polygonIndex][0]);
                polygonIndex++;
                break;
            default:
                break;
        }
        if (Number.isNaN(currentPosition[0]) || Number.isNaN(currentPosition[1])) {
            throw new Error("路径包含非法数据：" + command);
        }
    }
    return currentPolygon;
}

/**
 * 把多边形点集解析成pathData
 * @param polygon 形如：[ [[0,0],[100,0],[100,100],[0,100]], [[100,50],[150,0],[150,50]] ] || [ [0,0],[100,0],[100,100],[0,100] ]
 * @returns 'M0,0 L100,0 L100,100 L0,100 Z M100,50 L150,0 L150,50 Z' || 'M0,0 L100,0 L100,100 L0,100Z'
 */
export function parsePolygonToPathData(polygon: Polygon): string {
    let pathData = '';
    try {
        pathData = polygon.map(polygon => {
            return `M${polygon[0][0]},${polygon[0][1]} ` + polygon.slice(1, -1).map(point => `L${point[0]},${point[1]}`).join(' ');
        }).join(' Z ') + ' Z';
    } catch (error) {
        throw new Error("路径数据格式错误：" + error);
    }
    return pathData;
}

export function parseGeometryToPathData(geometry: Geometry): string {
    let pathData = '';
    try {
        if (Array.isArray(geometry[0][0][0])) {
            pathData = (geometry as MultiPolygon).map(polygon => {
                return parsePolygonToPathData(polygon);
            }).join(' ');

        } else {
            pathData = parsePolygonToPathData(geometry as Polygon);
        }
    } catch (error) {
        throw new Error("路径数据格式错误：" + error);
    }
    return pathData;
}

/**
 * 把pathData解析成点数组
 * @param pathData 形如：'M10,10 L20,20 L30,10 Z M40,40 L50,50 L60,40 Z'
 * @returns [ [ {x:10,y:10}, {x:20,y:20}, {x:30,y:10}], [ {x:40,y:40}, {x:50,y:50}, {x:60,y:40}] ]
 */
export function parsePathDataToPoints(pathData: string): Point[][] {
    const commands = pathData.match(/[a-df-zA-DF-Z][^a-df-zA-DF-Z]*/g);
    if (!commands) return [];

    const points: Point[][] = [[]];
    let currentPoint: Point = { X: 0, Y: 0 };
    let areaIndex = 0;

    for (const command of commands) {
        const params = command.slice(1).trim().split(/[\s,]+/).map(parseFloat);
        const commandLetter = command.charAt(0).toUpperCase();

        switch (commandLetter) {
            case 'M':
                points[areaIndex] = [];
                currentPoint = { X: params[0], Y: params[1] };
                points[areaIndex].push(currentPoint);
                break;
            case 'L':
                currentPoint = { X: params[0], Y: params[1] };
                points[areaIndex].push(currentPoint);
                break;
            case 'Z':
                areaIndex++;
                break;
            default:
                break;
        }
    }
    return points;
}

/**
 * 把点数组解析成pathData
 * @param points 形如：[ [ {x:10,y:10}, {x:20,y:20}, {x:30,y:10}], [ {x:40,y:40}, {x:50,y:50}, {x:60,y:40}] ]
 * @returns 'M10,10 L20,20 L30,10 Z M40,40 L50,50 L60,40 Z'
 */
export function parsePointsToPathData(points: Point[][]): string {
    if (points.length === 1) {
        return `M${points[0][0].X},${points[0][0].Y} ` + points[0].slice(1).map(point => `L${point.X},${point.Y}`).join(' ') + ' Z';
    } else {
        return points.map(points => `M${points[0].X},${points[0].Y} ` + points.slice(1).map(point => `L${point.X},${point.Y}`).join(' ')).join(' Z ') + ' Z';
    }
}

export let result: {
    union: Geometry;
    intersection: Geometry;
    difference: Geometry;
    xor: Geometry;
};

export const test = (path1: Geometry, path2: Geometry) => {
    result = {
        union: martinez.union(path1, path2),
        intersection: martinez.intersection(path1, path2),
        difference: martinez.diff(path1, path2),
        xor: martinez.xor(path1, path2)
    }
}
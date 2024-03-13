interface Point {
    x: number;
    y: number;
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
    let currentPoint: Point = { x: 0, y: 0 };
    let areaIndex = 0;

    for (const command of commands) {
        const params = command.slice(1).trim().split(/[\s,]+/).map(parseFloat);
        const commandLetter = command.charAt(0).toUpperCase();

        switch (commandLetter) {
            case 'M':
                points[areaIndex] = [];
                currentPoint = { x: params[0], y: params[1] };
                points[areaIndex].push(currentPoint);
                break;
            case 'L':
                currentPoint = { x: params[0], y: params[1] };
                points[areaIndex].push(currentPoint);
                break;
            case 'Z':
                areaIndex++;
                break;
            default:
                break;
        }
    }
    console.log(points);
    return points;
}

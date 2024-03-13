import { KonvaEventObject } from 'konva/lib/Node';
import React, { useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { Point } from './models';

const DrawingBoard: React.FC = () => {
    const [lines, setLines] = useState<Point[][]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isErasing, setIsErasing] = useState(false);

    const handleMouseDown = (event: KonvaEventObject<MouseEvent>) => {
        if (isErasing) {
            // 如果处于擦除状态，清除鼠标点击位置处的线条
            const stage = event.target.getStage();
            const point = stage?.getPointerPosition() ?? { x: 0, y: 0 };
            const newLines = lines.filter(line => {
                const distance = Math.sqrt(Math.pow(line[0].x - point.x, 2) + Math.pow(line[0].y - point.y, 2));
                return distance > 10; // 设置清除半径为10像素
            });
            setLines(newLines);
            return;
        }

        setIsDrawing(true);
        const { x, y } = event.target.getStage()?.getPointerPosition() ?? { x: 0, y: 0 };
        setLines([...lines, [{ x, y }]]);
    };

    const handleMouseMove = (event: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing) return;
        const stage = event.target.getStage();
        const point = stage?.getPointerPosition() ?? { x: 0, y: 0 };
        let lastLine = lines[lines.length - 1];
        lastLine = lastLine.concat([point]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines([...lines]);
    };

    const handleMouseUp = () => {
        setIsDrawing(false);
    };

    const toggleDrawingMode = () => {
        setIsErasing(!isErasing);
    };

    return (
        <div>
            <button onClick={toggleDrawingMode}>
                {isErasing ? '绘图模式' : '擦除模式'}
            </button>
            <Stage
                width={window.innerWidth}
                height={window.innerHeight}
                onMouseDown={handleMouseDown}
                onMousemove={handleMouseMove}
                onMouseup={handleMouseUp}
            >
                <Layer>
                    {lines.map((line, i) => (
                        <Line key={i} points={line.flatMap((p) => [p.x, p.y])} stroke="black" strokeWidth={2} />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};

export default DrawingBoard;

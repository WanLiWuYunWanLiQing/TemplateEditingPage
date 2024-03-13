import React, { useEffect, useRef } from 'react';
import Konva from 'konva';
import * as BO from './boolOperationHelper';


const BooleanOperations = () => {
    const stageRef = useRef<HTMLDivElement>(null);

    useEffect(() => {

        // 创建 Konva 舞台和层
        const stage = new Konva.Stage({
            container: stageRef.current!,
            width: window.innerWidth,
            height: window.innerHeight,
        });

        const layer = new Konva.Layer();
        stage.add(layer);

        // 定义两个简单的路径（矩形和圆形）
        const path1 = new Konva.Path({
            x: 100,
            y: 100,
            data: 'M0,0 L100,0 L100,100 L0,100 Z M100,50 L150,0 L150,50Z', // 矩形+三角形
            fill: 'blue',
        });

        const path2 = new Konva.Path({
            x: 100,
            y: 100,
            data: 'M-50,50 L50,50 L50,150 L-50,150 Z',
            fill: 'red',
        });

        // 将路径添加到图层
        layer.add(path1);
        layer.add(path2);

        BO.parsePathDataToPoints(path1.data());

        // 重绘图层
        layer.draw();

        // 清理函数
        return () => {
            layer.destroy();
            stage.destroy();
        };
    }, []); // 只在组件挂载时执行一次

    return <div ref={stageRef} />;
};

export default BooleanOperations;

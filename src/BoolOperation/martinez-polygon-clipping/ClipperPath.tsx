import React, { useRef } from 'react';
import { useMount } from 'ahooks';
import Konva from 'konva';
import * as BO from './boolOperationHelper';


const layer = new Konva.Layer();
const path = new Konva.Path({
    x: 250,
    y: 100,
    fill: 'green',
    fillRule: 'evenodd',
});
const Demo = () => {
    const stageRef = useRef<HTMLDivElement>(null);
    const [text, setText] = React.useState('click me');

    useMount(() => {
        // 创建 Konva 舞台和层
        const stage = new Konva.Stage({
            container: stageRef.current!,
            width: window.innerWidth * 0.95,
            height: window.innerHeight * 0.90,
        });


        stage.add(layer);

        // 定义两个简单的路径（矩形和圆形）
        const path1 = new Konva.Path({
            x: 100,
            y: 100,
            data: 'M0,0 L100,0 L100,100 L0,100 Z M100,50 L100,100 L150,50 Z', // 矩形+三角形  M100,50 L150,0 L150,50Z'
            fill: 'blue',
        });

        const path2 = new Konva.Path({
            x: 100,
            y: 100,
            data: 'M25,50 L125,50 L125,150 L25,150 Z',
            fill: 'red',
        });
        BO.test(BO.parsePathDataToPolygon(path1.data()), BO.parsePathDataToPolygon(path2.data()));

        // 将路径添加到图层
        layer.add(path1);
        layer.add(path2);

        // 重绘图层
        layer.draw();

        // 清理函数
        return () => {
            layer.destroy();
            stage.destroy();
        };
    });

    const handleClick = () => {
        if (text === 'click me') {
            setText('union');
            path.data(BO.parseGeometryToPathData(BO.result.union))
            layer.add(path);
        } else if (text === 'union') {
            setText('intersection');
            path.data(BO.parseGeometryToPathData(BO.result.intersection))
        } else if (text === 'intersection') {
            setText('difference');
            path.data(BO.parseGeometryToPathData(BO.result.difference))
        } else if (text === 'difference') {
            setText('xor');
            path.data(BO.parseGeometryToPathData(BO.result.xor))
            console.log('xor:', path.data());
        } else if (text === 'xor') {
            setText('union');
            path.data(BO.parseGeometryToPathData(BO.result.union))
            console.log('union:', path.data());
        }
        layer.draw();
    };

    return <>
        <button onClick={handleClick} style={{ width: 100 }}>{text}</button>
        <div ref={stageRef} />
    </>;
};

export default Demo;

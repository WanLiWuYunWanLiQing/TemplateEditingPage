import React, { useRef } from 'react';
import { useMount } from 'ahooks';
import Konva from 'konva';
import * as BO from './boolOperationHelper';


const layer = new Konva.Layer();
const path = new Konva.Path({
    y: 200,
    fill: 'rgba(0, 255, 0, 0.5)',
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

        const path1 = new Konva.Path({

            data: 'M100,50 L200,100 L300,50 L400,100 L500,50 L600,100 L700,50 L800,100 L900,50 L1000,100 L1000,200 L900,250 L800,200 L700,250 L600,200 L500,250 L400,200 L300,250 L200,200 L100,250 L100,150 Z',
            fill: 'blue',
        });

        const path2 = new Konva.Path({

            data: 'M50,50 L150,50 L150,150 L50,150 Z M200,50 L300,50 L300,150 L200,150 Z M350,50 L450,50 L450,150 L350,150 Z M500,50 L600,50 L600,150 L500,150 Z M650,50 L750,50 L750,150 L650,150 Z',
            fill: 'rgba(255, 0, 0, 0.5)',
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

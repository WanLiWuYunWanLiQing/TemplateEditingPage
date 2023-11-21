import { Unstable_Popup as BasePopup } from '@mui/base';
import {
  AddPhotoAlternate as AddLocalImageIcon,
  AddAPhoto as AddPhotoImageIcon,
  FormatShapes as AddRectModelAreaIcon,
  Delete as ClearIcon,
  FilterCenterFocus as ConcernPointIcon,
  EventAvailable as UpdateFeaturePointIcon,
  PanTool as MoveIcon,
  AutoFixHigh as EraserIcon,
  LinearScale as ResizeIcon
} from '@mui/icons-material';
import {
  Paper,
  IconButton,
  ToggleButtonGroup,
  Divider,
  ToggleButton,
  Tooltip,
  Box,
  Slider
} from '@mui/material';
import { useLatest, useMount } from 'ahooks';
import Konva from 'konva';
import { type KonvaEventObject } from 'konva/lib/Node';
import React, {
  forwardRef,
  useState,
  useRef,
  useImperativeHandle,
  useEffect
} from 'react';
import { useIntl } from 'react-intl';
import { Stage, Layer, Rect, Group, Path } from 'react-konva';
import { type Vector2d } from 'konva/lib/types';
import * as base64 from '@compass/common/helper/base64';
import { type GetCameraImageResponse } from '@compass/common/models/camera';
import { type Point } from '@compass/common/models/vision';
import { type Param } from '@compass/common/models/algorithm';
import {
  type Template,
  type GetFeaturePointsResponse
} from '@compass/common/models/template';
import useHelper from './drawingCanvasHelper';

let templateValue: Template;

interface DrawingCanvasProps {
  totalWidth: number;
  totalHeight: number;
  initialTemplateValue: Template;
  getLatestAlgPara: () => Param;
}

export interface DrawingCanvasHandles {
  saveModelAreaData: () => Promise<Template | undefined>;
}
// 绘图组件，完成模板创建过程中图形相关的操作并保存图形数据
const DrawingCanvas = forwardRef<DrawingCanvasHandles, DrawingCanvasProps>(
  (
    { totalWidth, totalHeight, initialTemplateValue, getLatestAlgPara },
    ref
  ) => {
    // 用于调整笔刷大小的slider组件的锚定物，主要功能是控制slider在哪弹出
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    const [sliderValue, setSliderValue] = useState(10);
    const [isChangingEraser, setIsChangingEraser] = useState(false);
    const [backgroundChangedTimes, setBackgroundChangedTimes] = useState(0);
    const [isBackgroundDraggable, setIsBackgroundDraggable] = useState(true);
    const [enableRectModelArea, setEnableRectModelArea] = useState(false);
    const latestEnableRectModelArea = useLatest(enableRectModelArea);
    const [rectCursorEnable, setRectCursorEnable] = useState(false);
    const [concernPointEnable, setConcernPointEnable] = useState(false);
    const [rectModelAreaPositionX, setRectModelAreaPositionX] = useState(100);
    const [rectModelAreaPositionY, setRectModelAreaPositionY] = useState(100);
    const [rectModelAreaSizeX, setRectModelAreaSizeX] = useState(100);
    const [rectModelAreaSizeY, setRectModelAreaSizeY] = useState(100);
    // 由于图片原始大小不一致，需要定制一个缩放范围保证相对清晰度（更底层的规则优先保证：min不能大于1，max不能小于1）
    const [zoomLimit, setZoomLimit] = useState({ min: 0.4, max: 4 });
    // // 绘图`图层`的缩放尺寸（背景图片的缩放尺寸存在useHelper中）
    // const [drawingLayerScale, setDrawingLayerScale] = useState<Vector2d>({
    //   x: 1,
    //   y: 1
    // });
    // 将shape的scale属性与unaffectedScale绑定，当背景缩放时总能保持shape的视觉大小不变
    const [unaffectedScale, setUnaffectedScale] = useState<Vector2d>({
      x: 1,
      y: 1
    });
    const [concernPointPosition, setConcernPointPosition] = useState({
      x: 0,
      y: 0
    });
    const intl = useIntl();
    const confirm = useConfirm();

    const { hmiHelper } = useRequestHelper();
    const snackbar = useSnackbar();
    const open = Boolean(anchor);
    const layerRef = useRef<Konva.Layer>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const templateRectRef = useRef<Konva.Rect>(null);
    const rectCursorRef = useRef<Konva.Rect>(null);
    const eraseGroupRef = useRef<Konva.Group>(null);
    const concerPointRef = useRef<Konva.Path>(null);
    const isErasingRef = useRef(false);

    /**
     * 绘图按钮：依次为 'drag', 'rect', 'erase', 'concern'
     */
    const toggleArray = ['drag', 'rect', 'erase', 'concern'];
    const [selectedOption, setSelectedOption] = useState(toggleArray[0]);
    const eraserSize = () => sliderValue * (layerRef.current?.scaleX() ?? 1);
    // 使用时需要区分坐标系，基于satge和layer的坐标在转到屏幕坐标时有一个偏移值处理
    const drawingHelper = useHelper();

    useImperativeHandle(ref, () => ({
      saveModelAreaData: async () => await saveModelAreaData()
    }));

    useMount(async () => {
      templateValue = initialTemplateValue;
      if (templateValue.backgroundImage) {
        console.log('当前模板存在背景图片');
      } else {
        if (templateValue.templateImage) {
          console.warn('当前模板不存在背景图片,使用模板图片替代');
        } else {
          console.error(`没有模板信息，获取相机图片:${templateValue.cameraId}`);
          await handleGetCameraImageById();
          setBackgroundChangedTimes(backgroundChangedTimes + 1);
        }
      }

      const transformer = new Konva.Transformer({
        nodes: [templateRectRef.current],
        visible: false,
        id: 'transformer',
        rotateEnabled: false // 暂时禁用旋转功能
      });
      layerRef.current?.add(transformer);
      templateRectRef.current?.on('click tap', e => {
        // 选择关注点的时候不允许自动切换
        if (selectedOption !== toggleArray[3]) {
          handleOptionChange(null, toggleArray[1]);
          // 结束事件
          e.cancelBubble = true;
        }
      });

      window.addEventListener('keydown', handleKeyDown);
      // 实现鼠标滚轮控制背景缩放
      layerRef.current?.on('wheel', e => {
        // 阻止默认滚动行为
        e.evt.preventDefault();
        const layer = layerRef.current;
        const stage = stageRef.current;
        // 获取鼠标位置
        const mousePos = stage?.getPointerPosition();
        if (stage && layer && mousePos) {
          const oldScale = layer.scaleX(); // 当前缩放比例

          const scaleFactor = e.evt.deltaY < 0 ? 1.1 : 0.9; // 根据滚轮方向确定缩放因子

          const scale = oldScale * scaleFactor; // 更新缩放比例
          if (scale > zoomLimit.max || scale < zoomLimit.min) {
            return;
          }

          // 计算新的位置，以保持鼠标光标在缩放后的中心
          const deltaX = mousePos.x - layer.x();
          const deltaY = mousePos.y - layer.y();

          const newX = mousePos.x - deltaX * scaleFactor;
          const newY = mousePos.y - deltaY * scaleFactor;

          // 应用缩放和新的位置
          layer.scale({ x: scale, y: scale });
          layer.position({ x: newX, y: newY });
          setUnaffectedScale({ x: 1 / scale, y: 1 / scale });
          try {
            const featurePointsContainer = layerRef.current?.findOne(
              '#featurePointsGroup'
            ) as Konva.Group;
            if (
              featurePointsContainer
              // && layerRef.current?.scaleX() % 0.2 < 0.05
            ) {
              featurePointsContainer.children.forEach(child => {
                const point = child as Konva.Circle;
                point.radius(
                  drawingHelper.clampNumber(
                    initialSize.featurePointRadius / scale,
                    0.5,
                    10
                  )
                );
              });
            }
          } catch (err) {
            console.error(`动态设置特征点大小失败：${err.message}`);
          }
        } else {
          console.warn(
            mousePos
              ? '未能获取到图层信息，请联系开发人员检查'
              : '未能获取到鼠标位置，请联系开发人员检查'
          );
        }
      });
    });

    useEffect(() => {
      const backgroundImage = new window.Image();
      backgroundImage.src = base64.base64ToDataURL(
        templateValue.backgroundImage ?? templateValue.templateImage ?? '',
        'image/bmp'
      );
      backgroundImage.addEventListener('load', () => {
        console.log('清除旧的模板图片...');
        layerRef.current?.findOne('#background')?.destroy();
        // 图像加载完成后执行以下操作
        const konvaImage = new Konva.Image({
          image: backgroundImage,
          width: backgroundImage.width,
          height: backgroundImage.height,
          id: 'background'
        });
        const layerWidth = layerRef.current?.width() ?? 500;
        const layerHeight = layerRef.current?.height() ?? 500;
        // 计算图像的位置、缩放比例
        const scale = Math.min(
          layerWidth / backgroundImage.width,
          layerHeight / backgroundImage.height
        );
        konvaImage.scaleX(scale);
        konvaImage.scaleY(scale);
        const x = (layerWidth - backgroundImage.width * scale) / 2;
        const y = (layerHeight - backgroundImage.height * scale) / 2;
        layerRef.current?.position({ x, y });
        drawingHelper.layerEnv = layerRef.current;
        drawingHelper.baseScale = scale;
        // 求缩放范围（为了保持清晰度），同时限制缩放范围的最值
        const limit = drawingHelper.clampPoint(
          drawingHelper.customMultiply(
            { x: zoomLimit.min, y: zoomLimit.max },
            scale
          ),
          { x: 0.1, y: 1 },
          { x: 1, y: 100 }
        );
        setZoomLimit({ min: limit.x, max: limit.y });
        // 第一次设置背景图片，也就是刚打开模板，这时需要读取建模区数据并显示出来
        if (backgroundChangedTimes === 0 && templateValue.modelingArea) {
          setEnableRectModelArea(true);
          const screenPosition = drawingHelper.convertLayerToPhysicalCoord(
            templateValue.modelingArea[0],
            false
          );
          const screenSize = drawingHelper.convertLayerToPhysicalCoord(
            templateValue.modelingArea[1],
            false
          );
          setRectModelAreaPositionX(screenPosition.x);
          setRectModelAreaPositionY(screenPosition.y);
          setRectModelAreaSizeX(screenSize.x);
          setRectModelAreaSizeY(screenSize.y);
          // 没有关注点代表模板中心就是关注点，只处理指定关注点的情况
          if (templateValue.concern?.x && templateValue.concern?.y) {
            setConcernPointPosition(
              drawingHelper.customAdd(
                drawingHelper.convertLayerToPhysicalCoord(
                  templateValue.concern,
                  false
                ),
                screenPosition
              )
            );
            setConcernPointEnable(true);
          }
          eraseGroupRef.current?.add(
            new Konva.Path({
              data: atob(templateValue.rsfFile),
              fill: usedColors.eraserFill
            })
          );
        }

        console.log('模板图片加载完成');
        // 添加图像到Layer
        layerRef.current?.add(konvaImage);
        konvaImage.moveToBottom();
      });
    }, [backgroundChangedTimes]);

    const handleOptionChange = (
      event: React.MouseEvent<HTMLElement> | null,
      newOption: string | null
    ) => {
      if (newOption !== null) {
        // 除了 ‘drag’ 功能其他功能都不允许拖动背景图片和显示调整框
        setIsBackgroundDraggable(false);
        layerRef.current?.findOne('#transformer')?.visible(false);
        // 除了‘erase’ 其他情况需要显示擦除框
        setRectCursorEnable(false);
        switch (newOption) {
          case toggleArray[0]:
            setIsBackgroundDraggable(true);
            templateRectRef.current?.setDraggable(false);
            break;
          case toggleArray[1]:
            layerRef.current?.findOne('#transformer')?.visible(true);
            templateRectRef.current?.setDraggable(true);
            if (latestEnableRectModelArea.current) {
              // TODO:当前只支持一个矩形建模区，后续要支持多个
              break;
            } else {
              setEnableRectModelArea(true);
              setRectModelAreaPositionX(
                (layerRef.current?.width() ?? 200) / 2 - 50
              );
              setRectModelAreaPositionY(
                (layerRef.current?.height() ?? 200) / 2 - 50
              );
              setRectModelAreaSizeX(100);
              setRectModelAreaSizeY(100);
            }
            break;
          case toggleArray[2]:
            setRectCursorEnable(true);
            break;
          case toggleArray[3]:
            break;
        }
        setSelectedOption(newOption);
        console.log(`切换操作模式为：${newOption}`);
      }
    };

    const handleChooseLocalImageClick = async (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      const file = event.target?.files?.[0];
      if (!file) {
        return;
      }
      const [base64Data] = await base64.fileToBase64(file);
      console.log('更新背景图片');
      templateValue.backgroundImage = base64Data;
      setBackgroundChangedTimes(backgroundChangedTimes + 1);
    };

    const handleGetCameraImageById = async () => {
      // 获取相机图片
      if (templateValue.cameraId > 0) {
        console.log(`相机ID：${templateValue.cameraId}`);
        setEnableRectModelArea(false);
        try {
          const detail = await hmiHelper.get<GetCameraImageResponse>(
            `/camera/${templateValue.cameraId}/observe`
          );

          templateValue.backgroundImage = await hmiHelper.get<string>(
            detail.imagePath,
            {
              responseBase64: true
            }
          );
          setBackgroundChangedTimes(backgroundChangedTimes + 1);
        } catch (err) {
          console.error(err);
          snackbar(
            'error',
            `${intl.$t({
              id: 'CreateTemplateDialog.Message_failedToGetCameraImage'
            })}:${err.message}`
          );
        }
      }
    };

    const handleResizeButtonClick = (event: React.MouseEvent<HTMLElement>) => {
      // 以被点击的组件为锚点弹出大小调整slider
      setAnchor(anchor ? null : event.currentTarget);
    };

    const handleSliderChanging = (
      _event: Event,
      newValue: number | number[]
    ) => {
      setSliderValue(newValue as number);
      setIsChangingEraser(true);
    };

    const handleSliderChangeCommitted = () => {
      setIsChangingEraser(false);
      // 调整完毕，关闭popup
      setAnchor(null);
    };

    const handleUpdateFeaturePoints = async () => {
      // 信息不全，提示用户
      if (!enableRectModelArea) {
        void confirm({
          description: intl.$t({
            id: 'CreateTemplateDialog.Message_noModelArea'
          })
        });
        return;
      }

      await saveModelAreaData();

      const latestParam = getLatestAlgPara();
      if (latestParam) {
        try {
          const featurePoints = await hmiHelper.post<GetFeaturePointsResponse>(
            '/algorithm/feature',
            {
              json: {
                param: latestParam,
                templateImage: templateValue.templateImage,
                maskImage: templateValue.maskImage
              }
            }
          );
          layerRef.current?.findOne('#featurePointsGroup')?.destroy();
          const featurePointsGroup = new Konva.Group({
            id: 'featurePointsGroup'
          });
          const templateOffset = drawingHelper.clampPoint(
            templateRectRef.current?.position() ?? { x: 0, y: 0 }
          );

          featurePoints.rows?.forEach((element: Point) => {
            // 后端接口返回坐标是基于模板坐标系的，转换到layer坐标系
            const myScreenCoord = drawingHelper.customAdd(
              templateOffset,
              drawingHelper.convertLayerToPhysicalCoord(element, false)
            );
            const circle = new Konva.Circle({
              x: myScreenCoord.x,
              y: myScreenCoord.y,
              radius:
                initialSize.featurePointRadius /
                (layerRef.current?.scaleX() ?? 1),
              fill: usedColors.featurePointFillColor // 圆点的颜色
            });
            featurePointsGroup.add(circle);
          });
          layerRef.current?.add(featurePointsGroup);
          featurePointsGroup.setZIndex(1);
          snackbar(
            'info',
            `${intl.$t({
              id: 'CreateTemplateDialog.Message_successToGetFeaturePoints'
            })}`
          );
        } catch (err) {
          snackbar(
            'error',
            `${intl.$t({
              id: 'CreateTemplateDialog.Message_failedToGetFeaturePoints'
            })}:${err.message}`
          );
          console.error(`获取特征点数据失败：${err.message}`);
        }
      } else {
        console.log('未能获取到算法参数信息');
      }
    };

    const handleClearButtonClick = () => {
      // 去除 建模区、特征点、掩膜、关注点
      setEnableRectModelArea(false);
      layerRef.current?.findOne('#featurePointsGroup')?.destroy();
      eraseGroupRef.current?.destroyChildren();
      setConcernPointEnable(false);

      handleOptionChange(null, toggleArray[0]);
    };

    const handleLyaerMouseDown = (e: KonvaEventObject<MouseEvent>) => {
      // 获取被点击的目标对象
      const target = e.target;
      // void saveModelAreaData(); // 测试用
      // 获取鼠标位置
      const pointer = stageRef.current?.getPointerPosition();

      drawingHelper.selectedPath?.fill(usedColors.eraserFill);
      if (target instanceof Konva.Path && selectedOption !== toggleArray[2]) {
        target.fill(usedColors.eraserSelectedFill);
        drawingHelper.selectedPath = target;
      }
      // 声明掩膜图案变量
      let path: Konva.Path;
      // 不同按钮功能的初始化
      switch (selectedOption) {
        case toggleArray[0]:
          break;
        case toggleArray[1]:
          if (!(target instanceof Konva.Rect)) {
            handleOptionChange(null, toggleArray[0]);
          }
          break;
        case toggleArray[2]:
          if (eraseGroupRef.current) {
            isErasingRef.current = true;
            path = new Konva.Path({
              data: drawingHelper.generateDataOfSingleErase(
                pointer,
                sliderValue,
                true
              ),
              fill: usedColors.eraserFill,
              fillRule: 'nonzero'
            });
            eraseGroupRef.current.add(path);
          }
          break;
        case toggleArray[3]:
          setConcernPointEnable(true);
          setConcernPointPosition(
            drawingHelper.convertStageToLayerCoord(pointer ?? { x: 0, y: 0 })
          );
          handleOptionChange(null, toggleArray[0]);
          break;
      }
    };

    const handleLyaerMouseMove = (e: KonvaEventObject<MouseEvent>) => {
      const pointer = stageRef.current?.getPointerPosition();
      const rectCursor = rectCursorRef.current;
      if (selectedOption === toggleArray[2]) {
        if (pointer) {
          rectCursor?.position(
            drawingHelper.customSubtract(
              drawingHelper.convertStageToLayerCoord(pointer),
              sliderValue / 2
            )
          );
          const allPathes = eraseGroupRef.current?.children;
          if (isErasingRef.current && allPathes) {
            const currentPath = allPathes[allPathes.length - 1] as Konva.Path;
            currentPath.data(
              drawingHelper.combineDataOfErase(
                currentPath.data(),
                pointer,
                sliderValue
              )
            );
          }
        } else {
          console.error(`自定义error：鼠标移动过程中未能读取到鼠标坐标`);
        }

        setRectCursorEnable(true);
      }
    };

    const handleLayerMouseLeave = (e: KonvaEventObject<MouseEvent>) => {
      // 不同状态下鼠标离开画布的情况
      switch (selectedOption) {
        case toggleArray[0]:
          break;
        case toggleArray[1]:
          break;
        case toggleArray[2]:
          handleLyaerMouseUp(e);
          if (rectCursorEnable) {
            setRectCursorEnable(false);
          }
          break;
        case toggleArray[3]:
          break;
      }
    };

    const handleLyaerMouseUp = (e: KonvaEventObject<MouseEvent>) => {
      console.log(`mouseup`);
      const pointer = stageRef.current?.getPointerPosition();
      // 不同状态下鼠标抬起的情况
      switch (selectedOption) {
        case toggleArray[0]:
          break;
        case toggleArray[1]:
          if (enableRectModelArea) {
            layerRef.current?.findOne('#transformer')?.visible(true);
            // handleOptionChange(null, toggleArray[0]);
            console.log(`建模完成`);
          }
          break;
        case toggleArray[2]:
          if (pointer) {
            handleLyaerMouseMove(e);
            isErasingRef.current = false;
            // handleOptionChange(null, toggleArray[0]);
          }
          break;
        case toggleArray[3]:
          break;
      }
    };
    // 按下 delete 键删除选中的掩膜
    const handleKeyDown = (event: { key: string }) => {
      if (event.key === 'Delete' && drawingHelper.selectedPath) {
        // eraseGroupRef.current?.children.find(drawingHelper.selectedPath)

        eraseGroupRef.current?.children.map(child => {
          if (child === drawingHelper.selectedPath) {
            return null;
          } else {
            return child;
          }
        });
        drawingHelper.selectedPath?.destroy();
      }
    };

    // 截取Rect范围的图像并转换为base64
    const saveModelAreaData = async () => {
      const templateLayer = new Konva.Layer();
      const maskLayer = new Konva.Layer();
      const backgroundIMG = layerRef.current?.findOne('#background');

      if (!backgroundIMG) {
        console.warn(
          '开发者日志：未能找到id为‘background’的背景图片，请检查确认'
        );
        return;
      }

      const backgroundImage = new window.Image();
      backgroundImage.src = base64.base64ToDataURL(
        templateValue.backgroundImage ?? templateValue.templateImage ?? '',
        'image/bmp'
      );
      return await new Promise<Template>(resolve => {
        backgroundImage.addEventListener('load', () => {
          // 图像加载完成后执行以下操作
          const templateImage = new Konva.Image({
            image: backgroundImage,
            width: backgroundImage.width,
            height: backgroundImage.height
          });
          const mmaskImage = new Konva.Rect({
            width: backgroundImage.width,
            height: backgroundImage.height,
            fill: 'white'
          });

          // 添加图像到Layer
          templateLayer.width(backgroundImage.width);
          templateLayer.height(backgroundImage.height);
          maskLayer.width(backgroundImage.width);
          maskLayer.height(backgroundImage.height);
          templateLayer.add(templateImage);
          maskLayer.add(mmaskImage);

          // 矩形建模区屏幕坐标
          const rectScreenPosition: Point = {
            x: templateRectRef.current?.position().x ?? 0,
            y: templateRectRef.current?.position().y ?? 0
          };
          // 矩形建模区物理坐标
          const rectPhysicalPosition: Point = drawingHelper.clampPoint(
            drawingHelper.convertLayerToPhysicalCoord(rectScreenPosition),
            { x: 0, y: 0 },
            templateImage.size()
          );
          console.log(
            `开发者日志：建模区大小=${templateImage.size().width},${
              templateImage.size().height
            }`
          );
          // 矩形建模区左侧溢出区域大小(带符号)
          const leftOverflowSize: Point = {
            x: rectScreenPosition.x > 0 ? 0 : rectScreenPosition.x,
            y: rectScreenPosition.y > 0 ? 0 : rectScreenPosition.y
          };
          // 矩形建模区屏幕尺寸（去除左侧溢出部分）
          const rectScreenSize: Point = drawingHelper.customAdd(
            drawingHelper.customMultiply(
              templateRectRef.current?.size() ?? { x: 0, y: 0 },
              templateRectRef.current?.scale() ?? { x: 1, y: 1 }
            ),
            leftOverflowSize
          );
          // 矩形建模区物理尺寸（同时去除右侧溢出部分）
          const rectPhysicalSize: Point = drawingHelper.clampPoint(
            drawingHelper.convertLayerToPhysicalCoord(rectScreenSize),
            { x: 0, y: 0 },
            drawingHelper.customSubtract(
              templateImage.size(),
              rectPhysicalPosition
            )
          );
          // 保存模板数据
          if (enableRectModelArea) {
            templateValue.templateImage =
              templateLayer
                ?.toDataURL({
                  x: rectPhysicalPosition.x,
                  y: rectPhysicalPosition.y,
                  width: rectPhysicalSize.x,
                  height: rectPhysicalSize.y
                })
                .split(',')[1] ?? templateValue.templateImage;

            // 掩膜数据
            let rsfFile = 'M0,0Z'; // 发空数据会被忽略，发个无效数据确保生效
            const maskPath = eraseGroupRef.current?.clone();
            if (maskPath) {
              maskPath.children.forEach(path => {
                if (path instanceof Konva.Path) {
                  rsfFile += path.data();
                  // 转换为黑白图片保存
                  path.fill('black');
                }
              });
              maskPath.scaleX(1 / drawingHelper.baseScale);
              maskPath.scaleY(1 / drawingHelper.baseScale);
              maskLayer.add(maskPath);
            }

            templateValue.rsfFile = btoa(rsfFile);
            templateValue.maskImage =
              maskLayer
                ?.toDataURL({
                  x: rectPhysicalPosition.x,
                  y: rectPhysicalPosition.y,
                  width: rectPhysicalSize.x,
                  height: rectPhysicalSize.y
                })
                .split(',')[1] ?? templateValue.maskImage;
            templateValue.modelingArea = [
              rectPhysicalPosition,
              rectPhysicalSize
            ];
            // 计算关注点的真实坐标（物理坐标减去模板起点物理坐标）
            templateValue.concern = concernPointEnable
              ? drawingHelper.customSubtract(
                  drawingHelper.convertLayerToPhysicalCoord(
                    concernPointPosition
                  ),
                  rectPhysicalPosition
                )
              : { x: 0, y: 0 };
          } else {
            // 没有创建建模区，将相关数据置空
            templateValue.templateImage = '';
            templateValue.maskImage = '';
            templateValue.modelingArea = [];
          }

          resolve(templateValue);
        });
      });
    };

    const containerStyle = {
      height: totalHeight
      //     border: '1px solid #000'
    };
    const paperStyle = {
      height: 30
    };
    const iconButtonStyle = {
      height: 28,
      width: 28,
      top: -3.5,
      margin: '0 auto' /* 水平居中，上下外边距为0，左右外边距自动分配 */,
      // '0px 1px 0px 1px' /* 顺序为上、右、下、左 */
      zIndex: 100
    };
    // 读取图片的button比一般button多了一个 input 子元素，需要调整间距
    const iconButtonWithInputStyle = { ...iconButtonStyle, top: 0 };
    const toggleButtonStyle = {
      height: 28,
      width: 28
    };
    const stageStyle = {
      width: totalWidth,
      height: totalHeight - paperStyle.height - 2
    };

    const usedColors = {
      modelAreaFill: 'rgba(78, 100, 186, 0.3)',
      eraserStroke: 'rgba(230, 0, 0)',
      eraserFill: 'rgba(250, 0, 0,0.5)',
      eraserSelectedFill: 'rgba(255, 50, 50,0.8)',
      backGroundFill: '#bbc2c9',
      backGroundStroke: 'gray',
      featurePointFillColor: 'green'
    };

    const initialSize = {
      featurePointRadius: 2,
      concernSize: {
        width: 10,
        height: 10
      }
    };

    return (
      <div id="container" style={containerStyle}>
        <Paper elevation={2} style={paperStyle}>
          <IconButton component="label" style={iconButtonWithInputStyle}>
            <Tooltip
              title={intl.$t({
                id: 'CreateTemplateDialog.OpenImgFromDisk'
              })}>
              <div>
                <AddLocalImageIcon />
                <input
                  type="file"
                  accept="image/bmp,image/jpeg,image/png"
                  onChange={handleChooseLocalImageClick}
                />
              </div>
            </Tooltip>
          </IconButton>
          <IconButton
            style={iconButtonStyle}
            onClick={handleGetCameraImageById}>
            <Tooltip
              title={intl.$t({
                id: 'CreateTemplateDialog.CreateTemplateFromCamera'
              })}>
              <AddPhotoImageIcon />
            </Tooltip>
          </IconButton>

          <ToggleButtonGroup
            color="primary"
            value={selectedOption}
            exclusive
            onChange={handleOptionChange}>
            <Divider flexItem orientation="vertical" sx={{ mx: 0.5, my: 1 }} />
            <ToggleButton value="drag" style={toggleButtonStyle}>
              <Tooltip
                title={intl.$t({
                  id: 'CreateTemplateDialog.MoveTemplate'
                })}>
                <MoveIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="rect" style={toggleButtonStyle}>
              <Tooltip
                title={intl.$t({
                  id: 'CreateTemplateDialog.RectModelArea'
                })}>
                <AddRectModelAreaIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="concern" style={toggleButtonStyle}>
              <Tooltip
                title={intl.$t({
                  id: 'CreateTemplateDialog.SelectFocalPoint'
                })}>
                <ConcernPointIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="erase" style={toggleButtonStyle}>
              <Tooltip
                title={intl.$t({
                  id: 'CreateTemplateDialog.Eraser'
                })}>
                <EraserIcon />
              </Tooltip>
            </ToggleButton>
            <Divider flexItem orientation="vertical" sx={{ mx: 0.5, my: 1 }} />
          </ToggleButtonGroup>

          <IconButton style={iconButtonStyle} onClick={handleResizeButtonClick}>
            <Tooltip
              title={intl.$t({
                id: 'CreateTemplateDialog.EraserSize'
              })}>
              <ResizeIcon />
            </Tooltip>
          </IconButton>
          <BasePopup open={open} anchor={anchor}>
            <Box sx={{ width: 100 }}>
              <Slider
                size="small"
                min={1}
                max={50}
                defaultValue={10}
                aria-label="Small"
                valueLabelDisplay="auto"
                value={sliderValue}
                onChange={handleSliderChanging}
                onChangeCommitted={handleSliderChangeCommitted}
              />
            </Box>
          </BasePopup>
          <IconButton
            style={iconButtonStyle}
            onClick={handleUpdateFeaturePoints}>
            <Tooltip
              title={intl.$t({
                id: 'CreateTemplateDialog.UpdateFeaturePoints'
              })}>
              <UpdateFeaturePointIcon />
            </Tooltip>
          </IconButton>
          <IconButton style={iconButtonStyle} onClick={handleClearButtonClick}>
            <Tooltip
              title={intl.$t({
                id: 'CreateTemplateDialog.Clear'
              })}>
              <ClearIcon />
            </Tooltip>
          </IconButton>
        </Paper>

        <Stage
          ref={stageRef}
          // 这里不能用 style 会导致图片显示不出来
          width={totalWidth}
          height={totalHeight - paperStyle.height - 2}>
          <Layer id="background-layer" listening={false}>
            <Rect
              width={stageStyle.width}
              height={stageStyle.height}
              fill={usedColors.backGroundFill}
            />
          </Layer>
          <Layer
            id="drawing-layer"
            listening
            ref={layerRef}
            draggable={isBackgroundDraggable}
            onMouseDown={handleLyaerMouseDown}
            onMouseMove={handleLyaerMouseMove}
            onMouseUp={handleLyaerMouseUp}
            onMouseLeave={handleLayerMouseLeave}
            imageSmoothingEnabled={false}>
            <Rect
              id={'rectModelArea'}
              x={rectModelAreaPositionX}
              y={rectModelAreaPositionY}
              width={rectModelAreaSizeX}
              height={rectModelAreaSizeY}
              fill={usedColors.modelAreaFill}
              draggable={false}
              visible={enableRectModelArea}
              ref={templateRectRef}
            />
            <Rect
              id={'rectCursor'}
              width={sliderValue}
              height={sliderValue}
              stroke={usedColors.eraserStroke}
              strokeWidth={1}
              fill={usedColors.eraserFill}
              draggable={false}
              ref={rectCursorRef}
              visible={rectCursorEnable}
            />
            {/* <Line
              fill={usedColors.eraserFill}
              points={[100, 100, 100, 200, 200, 200, 200, 100]}
              closed={true}
            /> */}
            <Group id="eraseGroup" ref={eraseGroupRef} />
            <Path
              id="concernPoint"
              ref={concerPointRef}
              data="M11, 1 A1 1 0 0,1 13,1 L13 8 A1 1 0 0,1 11 8z M1, 11 A1 1 0 0,0 1,13 L8 13 A1 1 0 0,0 8 11z M11, 23 A1 1 0 0,0 13,23 L13 16 A1 1 0 0,0 11 16z M23, 11 A1 1 0 0,1 23,13 L16 13 A1 1 0 0,1 16 11z M11 12 A1 1 0 0 1 13 12 A1 1 0 0 1 11 12z"
              fill="#00FF3C"
              // 12 的意义： data 定义的size=(24,24),(12，12)就是中心坐标
              x={concernPointPosition.x - unaffectedScale.x * 12}
              y={concernPointPosition.y - unaffectedScale.y * 12}
              scale={unaffectedScale}
              visible={concernPointEnable}
            />
          </Layer>
          <Layer id="forground-layer" listening={false}>
            <Rect
              width={stageStyle.width}
              height={stageStyle.height}
              stroke={usedColors.backGroundStroke}
              strokeWidth={2}
            />
            <Rect
              id="showEraserSize"
              x={(stageStyle.width - eraserSize()) / 2}
              y={(stageStyle.height - eraserSize()) / 2}
              width={eraserSize()}
              height={eraserSize()}
              stroke={usedColors.eraserStroke}
              strokeWidth={1}
              fill={usedColors.eraserFill}
              visible={isChangingEraser}
            />
          </Layer>
        </Stage>
      </div>
    );
  }
);

DrawingCanvas.displayName = 'DrawingCanvas';

export default DrawingCanvas;

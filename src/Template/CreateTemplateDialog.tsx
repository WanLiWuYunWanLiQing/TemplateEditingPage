import React, { useState, useRef, type FC } from 'react';
import {
  Button,
  DialogContent,
  DialogActions,
  Grid,
  Checkbox,
  Paper,
  Typography,
  Divider,
  Tooltip
} from '@mui/material';
import { useMount, useSize } from 'ahooks';
import { FormContainer, useForm, TextFieldElement } from 'react-hook-form-mui';
import { useIntl } from 'react-intl';
import { useSnackbar } from '@compass/components/Snackbar';
import { Dialog, type DialogComponentProps } from '@compass/components/Dialog';
import LoadingWrapper from '@compass/components/LoadingWrapper';
import VisionEvent from '@compass/common/events/vision';
import { useRequestHelper } from '@compass/common/hooks/request';
import { dispatchToMain } from '@compass/common/helper/bus';
import { useIpcSender } from '@compass/common/hooks/electron';
import { useConfirm } from '@compass/components/Confirm';
import {
  getEmptyTemplate,
  type CreateOrUpdateTemplateResponse,
  type GetTemplateResponse,
  type Template
} from '@compass/common/models/template';
import {
  type GetAlgParamResponse,
  getEmptyParam,
  Param
} from '@compass/common/models/algorithm';
import { useDialog } from '@compass/components/Dialog';
import IpcEvent from '@compass/main/electron/main/ipc';
import * as rules from '@compass/main/rules';
import DrawingCanvas, {
  type DrawingCanvasHandles
} from '@compass/main/views/Dialog/Vision/Template/DrawingCanvas';

let allTemplateIDs: number[];
let initialTemplateValue: Template;

const CreateTemplateDialog: FC<DialogComponentProps> = props => {
  const formContext = useForm<Template>({
    defaultValues: getEmptyTemplate(),
    mode: 'all'
  });

  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  const drawingCanvasRef = useRef<DrawingCanvasHandles>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const { hmiHelper } = useRequestHelper();
  const ipcSender = useIpcSender();
  const gridSize = useSize(gridRef);
  const intl = useIntl();

  const dialog = useDialog();
  const snackbar = useSnackbar();
  const confirm = useConfirm();

  useMount(async () => {
    await init();
    setLoading(false);
  });
  // 初始化：为需要赋值的变量赋值
  const init = async () => {
    // 第一步，获取父窗体传递过来的全体模板的数据
    allTemplateIDs = props.params?.templateList?.map((o: Template) => o.id);
    // 第二步，获取定义好的模板数据（2选1）
    await getInitialTemplateValue();
    // 第三步，设置表单数据
    // 后端 null 、 0 不返回，需要处理，调用getEmptyParam 将undefined转换为 0 ，reset中 将undefined 转换为 false

    initialTemplateValue.isAlgParamGlobal
      ? await getGlobalAlgParam(true)
      : (initialTemplateValue.algParam = getEmptyParam(
          initialTemplateValue.algParam
        ));
    formContext.reset({
      ...initialTemplateValue,
      isAlgParamGlobal: initialTemplateValue.isAlgParamGlobal ?? false
    });
    // 必须使用 formContext.getValues，因为 formData有延迟，同一代码块中无法跟踪formContext
    setIsReadOnly(formContext.getValues('isAlgParamGlobal'));
  };
  // 获取初始传入的模板值
  const getInitialTemplateValue = async () => {
    if (!props.params?.isCreate) {
      try {
        const detail = await hmiHelper.get<GetTemplateResponse>(
          `/template/${props.params?.templateId}`
        );
        initialTemplateValue = detail.template;
        console.log(
          `开发者日志：关注点=（${
            initialTemplateValue.concern?.x ?? 'undefined'
          },${initialTemplateValue.concern?.y ?? 'undefined'}）`
        );
      } catch (err) {
        console.error(err);
        snackbar(
          'error',
          `${intl.$t({
            id: 'CreateTemplateDialog.Message_failedToGetTemplateData'
          })}:${err.message}`
        );
      }
    } else {
      // id 和 name 给一个初始值
      let id = 1;
      while (allTemplateIDs.includes(id)) {
        id++;
      }
      initialTemplateValue = getEmptyTemplate(id);
      initialTemplateValue.name = `template${initialTemplateValue.id.toString()}`;
      initialTemplateValue.cameraId = props.params?.cameraId;
    }
    // 更新算法参数，getEmptyParam 方法的意义在于将网络传输中忽略的参数赋为默认值‘0’

    initialTemplateValue.isAlgParamGlobal
      ? await getGlobalAlgParam()
      : (initialTemplateValue.algParam = getEmptyParam(
          initialTemplateValue.algParam
        ));
  };
  // 获取全局参数值，参数 initial 区分此模板的 初始值 是否就是 全局参数
  const getGlobalAlgParam = async (initial?: boolean) => {
    try {
      const detail =
        await hmiHelper.get<GetAlgParamResponse>('/algorithm/param');
      if (initial) {
        initialTemplateValue.algParam = getEmptyParam(detail.param);
      } else {
        formContext.setValue('algParam', getEmptyParam(detail.param));
      }
    } catch (err) {
      console.error(err);
      snackbar(
        'error',
        `${intl.$t({
          id: 'CreateTemplateDialog.Message_failedToGetGlobalParam'
        })}:${err.message}`
      );
    }
  };

  const getDefaultAlgParam = async () => {
    try {
      const detail = await hmiHelper.get<GetAlgParamResponse>(
        '/algorithm/param/default'
      );
      formContext.setValue('algParam', getEmptyParam(detail.param));
    } catch (err) {
      console.error(err);
      snackbar(
        'error',
        `${intl.$t({
          id: 'CreateTemplateDialog.Message_failedToGetDefaultParam'
        })}:${err.message}`
      );
    }
  };

  const handleGlobalParamCheck = async () => {
    console.log(`是否要使用全局参数：${!isReadOnly}`);
    if (!isReadOnly) {
      await getGlobalAlgParam();
    }
    formContext.setValue('isAlgParamGlobal', !isReadOnly);
    setIsReadOnly(!isReadOnly);
  };

  const handleDefaultParamClick = async () => {
    await getDefaultAlgParam();
  };

  const handleClose = () => {
    if (props.window) {
      ipcSender.send(IpcEvent.CloseDialog);
    } else {
      props.onClose();
    }
  };

  const handleSubmit = async (data: Template) => {
    console.log('提交模板数据');
    await drawingCanvasRef.current?.saveModelAreaData().then(value => {
      console.log('获取模板图像数据成功');
      formContext.reset({
        ...data,
        // 模板相关图像数据以 DrawingCanvas 中的为准
        backgroundImage: value?.backgroundImage,
        templateImage: value?.templateImage,
        maskImage: value?.maskImage,
        concern: value?.concern,
        rsfFile: value?.rsfFile,
        modelingArea: value?.modelingArea
      });
    });
    // 这里更新 data 变量，不然上面的修改无法同步到 data
    data = formContext.watch();

    // 信息不全，提示用户
    if (data.templateImage.length < 20) {
      void confirm({
        description: intl.$t({
          id: 'CreateTemplateDialog.Message_noModelArea'
        })
      });
      return;
    }

    console.log('正在调用接口');
    setLoading(true);
    if (props.params?.isCreate) {
      try {
        const res = await hmiHelper.post<CreateOrUpdateTemplateResponse>(
          '/template',
          {
            json: {
              template: data
            }
          }
        );
        if (res.isAlgorithmSuccess) {
          dispatchToMain(VisionEvent.UpdatedCameraList);
          handleClose();
        } else {
          throw Error(res.algorithmMessage);
        }
      } catch (err) {
        snackbar(
          'error',
          `${intl.$t({
            id: 'CreateTemplateDialog.Message_failedToCreatTemplate'
          })}:${err.message}`
        );
        console.warn('error', `新建模板失败:${err.message}`);
        setLoading(false);
      }
    } else {
      try {
        const res = await hmiHelper.put<CreateOrUpdateTemplateResponse>(
          `/template/${props.params?.templateId}`,
          {
            json: {
              template: data
            }
          }
        );
        if (res.isAlgorithmSuccess) {
          dispatchToMain(VisionEvent.UpdatedCameraList);
          handleClose();
        } else {
          throw Error(res.algorithmMessage);
        }
      } catch (err) {
        snackbar(
          'error',
          `${intl.$t({
            id: 'CreateTemplateDialog.Message_failedToUpdateTemplate'
          })}:${err.message}`
        );
        console.warn(`更新模板失败:${err.message}`);
        setLoading(false);
      }
    }
  };

  const onLatestParamRequest = () => formContext.getValues('algParam');

  const paperStyle = {
    padding: 20,
    margin: '5px'
  };
  const buttonStyle = { height: '40px' };

  return (
    <Dialog
      onClose={handleClose}
      open={props.open}
      window={props.window}
      closeIcon
      title={intl.$t({
        id: props.params?.isCreate
          ? 'CreateTemplateDialog.CreateTemplate'
          : 'CreateTemplateDialog.EditTemplate'
      })}>
      <LoadingWrapper loading={loading} sx={{ minWidth: 1250, minHeight: 700 }}>
        <FormContainer formContext={formContext} onSuccess={handleSubmit}>
          <DialogContent dividers>
            <Grid container sx={{ minWidth: 1200, minHeight: 600 }}>
              <Grid
                item
                xs={9}
                ref={gridRef}
                sx={{ minWidth: 900, minHeight: 500 }}>
                {(gridSize?.width ?? 0) > 0 && (
                  <DrawingCanvas
                    totalWidth={Number(gridSize?.width)}
                    totalHeight={Number(gridSize?.height)}
                    initialTemplateValue={formContext.watch()}
                    getLatestAlgPara={onLatestParamRequest}
                    ref={drawingCanvasRef}
                  />
                )}
              </Grid>
              <Grid item xs={3} sx={{ minWidth: 300, minHeight: 600 }}>
                <Paper elevation={3} style={paperStyle}>
                  {/* 在 Paper 组件中包含其他组件 */}
                  <Typography variant="overline" />
                  <TextFieldElement
                    name="id"
                    label={intl.$t({
                      id: 'CreateTemplateDialog.TemplateID'
                    })}
                    validation={{
                      validate: value =>
                        rules.validateId(
                          value,
                          allTemplateIDs,
                          props.params?.templateId
                        )
                    }}
                  />
                  <TextFieldElement
                    name="name"
                    label={intl.$t({
                      id: 'CreateTemplateDialog.TemplateName'
                    })}
                    validation={{
                      validate: value => rules.validateName(value, false)
                    }}
                  />
                </Paper>
                <Paper elevation={3} style={paperStyle}>
                  {/* 在 Paper 组件中包含其他组件 */}
                  <Typography variant="subtitle1">
                    {intl.$t({
                      id: 'CreateTemplateDialog.AlgorithmParam'
                    })}
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      {/* Tooltip 组件中添加 div 是为了让 tip 正常显示 */}
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.SamlpeFeatureCNT'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tSampleFeatureCnt"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.SamlpeFeatureCNT'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tSampleFeatureCnt'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.FeatureSize'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tFeatureSize"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.FeatureSize'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tFeatureSize'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.TeachAngleStep'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tTeachAngleStep"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.TeachAngleStep'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tTeachAngleStep'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.FeatureLineMinLen'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tTeachFealineMin"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.FeatureLineMinLen'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tTeachFealineMin'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.TeachGradTH'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tTeachGradTh"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.TeachGradTH'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tTeachGradTh'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.TeachStartAng'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tTeachStartAng"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.TeachStartAng'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tTeachStartAng'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.TeachAngleCNT'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.tTeachAngleCnt"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.TeachAngleCNT'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tTeachAngleCnt'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.SampleFeatureMinDistance'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled
                            name="algParam.tSampleFeatureDistance"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.SampleFeatureMinDistance'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'tSampleFeatureDistance'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={8}>
                      <Divider orientation="horizontal" />
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.MatchCollectTH'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.mMatchCollectTh"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.MatchCollectTH'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'mMatchCollectTh'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.MatchGradTH'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.mMatchGradTh"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.MatchGradTH'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'mMatchGradTh'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={6}>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.MatchRefineTH'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.mMatchRefineTh"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.MatchRefineTH'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'mMatchRefineTh'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                      <Tooltip
                        title={intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.MaxResultCNT'
                        })}>
                        <div>
                          <TextFieldElement
                            disabled={isReadOnly}
                            name="algParam.mMaxResultCnt"
                            label={intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.MaxResultCNT'
                            })}
                            validation={{
                              validate: value =>
                                rules.validateAlgParameter(
                                  value,
                                  'mMaxResultCnt'
                                )
                            }}
                          />
                        </div>
                      </Tooltip>
                    </Grid>
                    <Grid item xs={12}>
                      <Divider orientation="horizontal" />
                    </Grid>
                    <Grid item xs={6}>
                      <Grid container spacing={1}>
                        <Grid item xs={2.5}>
                          <Checkbox
                            checked={isReadOnly}
                            style={buttonStyle}
                            onChange={handleGlobalParamCheck}
                            color="primary"
                          />
                        </Grid>
                        <Grid item xs={9.5}>
                          <Button
                            style={buttonStyle}
                            onClick={() => {
                              dialog.showDialogWindow(
                                'ChangeVisionProcedureParameterDialog'
                              );
                            }}>
                            {intl.$t({
                              id: 'ChangeVisionProcedureParameterDialog.GlobalParam'
                            })}
                          </Button>
                        </Grid>
                      </Grid>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        disabled={isReadOnly}
                        style={buttonStyle}
                        onClick={handleDefaultParamClick}>
                        {intl.$t({
                          id: 'ChangeVisionProcedureParameterDialog.RestoreDefaultValues'
                        })}
                      </Button>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={handleClose}>
              {intl.$t({ id: 'Generic.Cancel' })}
            </Button>
            <Button type="submit">{intl.$t({ id: 'Generic.Confirm' })}</Button>
          </DialogActions>
        </FormContainer>
      </LoadingWrapper>
    </Dialog>
  );
};

export default CreateTemplateDialog;

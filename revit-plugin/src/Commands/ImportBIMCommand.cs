using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Rheem.Rysnova.RevitPlugin.Models;
using Rheem.Rysnova.RevitPlugin.Services;

namespace Rheem.Rysnova.RevitPlugin.Commands
{
    /// <summary>
    /// 从瑞美HVAC AI平台导入BIM设计方案到Revit
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ImportBIMCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;
            
            try
            {
                // 1. 显示项目选择对话框
                using (var dialog = new UI.ProjectSelectionDialog())
                {
                    if (dialog.ShowDialog() != System.Windows.Forms.DialogResult.OK)
                        return Result.Cancelled;
                    
                    string projectId = dialog.SelectedProjectId;
                    
                    // 2. 从平台拉取BIM数据
                    var apiClient = new RysnovaAPIClient();
                    BIMProject bimData = apiClient.FetchProject(projectId);
                    
                    if (bimData == null || bimData.Devices == null || !bimData.Devices.Any())
                    {
                        TaskDialog.Show("Rysnova BIM", "未找到BIM数据或设备列表为空");
                        return Result.Failed;
                    }
                    
                    // 3. 进度对话框
                    var progress = new UI.ProgressDialog($"导入 {bimData.Devices.Count} 个设备...");
                    progress.Show();
                    
                    // 4. 启动事务
                    using (Transaction trans = new Transaction(doc, "导入Rysnova BIM"))
                    {
                        trans.Start();
                        
                        var familyMapper = new FamilyMappingService(doc);
                        var pipeMapper = new PipeMappingService(doc);
                        
                        int imported = 0;
                        int failed = 0;
                        var errors = new List<string>();
                        
                        // 5. 导入设备
                        for (int i = 0; i < bimData.Devices.Count; i++)
                        {
                            var device = bimData.Devices[i];
                            progress.UpdateProgress(i, bimData.Devices.Count, 
                                $"导入设备: {device.Name}");
                            
                            try
                            {
                                FamilyInstance instance = familyMapper.CreateDevice(device);
                                if (instance != null)
                                {
                                    // 写入参数
                                    SetDeviceParameters(instance, device);
                                    imported++;
                                }
                                else
                                {
                                    failed++;
                                    errors.Add($"无法创建设备族: {device.Name} ({device.Type})");
                                }
                            }
                            catch (Exception ex)
                            {
                                failed++;
                                errors.Add($"{device.Name}: {ex.Message}");
                            }
                        }
                        
                        // 6. 导入管道
                        int pipesImported = 0;
                        if (bimData.Pipes != null)
                        {
                            foreach (var pipe in bimData.Pipes)
                            {
                                try
                                {
                                    if (pipeMapper.CreatePipe(pipe) != null)
                                        pipesImported++;
                                }
                                catch (Exception ex)
                                {
                                    errors.Add($"管道{pipe.Id}: {ex.Message}");
                                }
                            }
                        }
                        
                        trans.Commit();
                        progress.Close();
                        
                        // 7. 显示结果
                        var report = new System.Text.StringBuilder();
                        report.AppendLine($"✅ 设备导入: {imported}/{bimData.Devices.Count}");
                        report.AppendLine($"✅ 管道导入: {pipesImported}");
                        if (failed > 0)
                        {
                            report.AppendLine($"⚠️ 失败: {failed} 项");
                            report.AppendLine();
                            report.AppendLine("失败详情:");
                            foreach (var err in errors.Take(10))
                                report.AppendLine($"  - {err}");
                        }
                        
                        TaskDialog.Show("Rysnova BIM 导入完成", report.ToString());
                    }
                }
                
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = "导入失败: " + ex.Message;
                return Result.Failed;
            }
        }
        
        private void SetDeviceParameters(FamilyInstance instance, BIMDevice device)
        {
            // 写入Rysnova自定义参数
            SetParam(instance, "Rysnova_DeviceID", device.Id);
            SetParam(instance, "Rysnova_DeviceType", device.Type);
            SetParam(instance, "Rysnova_Brand", device.Brand);
            SetParam(instance, "Rysnova_Model", device.Model);
            SetParam(instance, "Rysnova_Power", device.Power);
            SetParam(instance, "Rysnova_LastSync", DateTime.Now.ToString("o"));
            
            // 标准参数
            SetParam(instance, "Comments", $"Imported from Rysnova {DateTime.Now:yyyy-MM-dd}");
        }
        
        private void SetParam(FamilyInstance inst, string name, object value)
        {
            try
            {
                var param = inst.LookupParameter(name);
                if (param == null || param.IsReadOnly) return;
                
                if (value is string s) param.Set(s);
                else if (value is double d) param.Set(d);
                else if (value is int i) param.Set(i);
                else if (value != null) param.Set(value.ToString());
            }
            catch { /* 忽略参数设置错误 */ }
        }
    }
}

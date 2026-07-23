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
    /// 双向增量同步 - 自动检测平台和Revit的变更并合并
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class SyncBIMCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;
            
            try
            {
                string projectId = GetCurrentProjectId(doc);
                if (string.IsNullOrEmpty(projectId))
                {
                    TaskDialog.Show("Rysnova同步", "当前文档未关联Rysnova项目,请先导入或导出");
                    return Result.Failed;
                }
                
                var apiClient = new RysnovaAPIClient();
                
                // 1. 获取平台版本
                var platformProject = apiClient.FetchProject(projectId);
                
                // 2. 提取本地Revit数据
                var localProject = ExtractLocalProject(doc, projectId);
                
                // 3. 计算差异
                var diff = SyncDiffEngine.Compare(localProject, platformProject);
                
                // 4. 显示同步预览
                using (var dialog = new UI.SyncPreviewDialog(diff))
                {
                    var result = dialog.ShowDialog();
                    if (result != System.Windows.Forms.DialogResult.OK)
                        return Result.Cancelled;
                    
                    var actions = dialog.SelectedActions;
                    
                    // 5. 执行同步
                    using (Transaction trans = new Transaction(doc, "Rysnova双向同步"))
                    {
                        trans.Start();
                        
                        var syncService = new BIMSyncService(doc, apiClient);
                        var report = syncService.ExecuteSync(actions, platformProject, localProject);
                        
                        trans.Commit();
                        
                        // 6. 显示同步报告
                        var summary = $"✅ 同步完成\n\n" +
                                     $"📥 从平台拉取:\n" +
                                     $"  • 新增设备: {report.DevicesAdded}\n" +
                                     $"  • 更新设备: {report.DevicesUpdated}\n" +
                                     $"  • 删除设备: {report.DevicesRemoved}\n\n" +
                                     $"📤 推送到平台:\n" +
                                     $"  • 上传变更: {report.UploadedChanges}\n\n" +
                                     $"⚠️ 冲突: {report.Conflicts.Count} 项";
                        
                        if (report.Conflicts.Any())
                        {
                            summary += "\n\n冲突详情:\n";
                            foreach (var c in report.Conflicts.Take(5))
                                summary += $"  • {c.Description}\n";
                        }
                        
                        TaskDialog.Show("同步完成", summary);
                    }
                }
                
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = "同步失败: " + ex.Message;
                return Result.Failed;
            }
        }
        
        private string GetCurrentProjectId(Document doc)
        {
            // 从项目信息读取Rysnova项目ID
            var projectInfo = doc.ProjectInformation;
            return projectInfo.LookupParameter("Rysnova_ProjectID")?.AsString();
        }
        
        private BIMProject ExtractLocalProject(Document doc, string projectId)
        {
            // 复用ExportBIMCommand的逻辑提取本地数据
            var exporter = new BIMExporter(doc);
            var project = exporter.Extract();
            project.ProjectId = projectId;
            return project;
        }
    }
}

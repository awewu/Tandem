using System;
using System.IO;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;

namespace Rheem.Rysnova.RevitPlugin
{
    /// <summary>
    /// Rysnova BIM Plugin - Revit应用入口
    /// 在Revit启动时加载，注册Ribbon面板和命令
    /// </summary>
    public class RysnovaBIMApp : IExternalApplication
    {
        private const string TabName = "Rysnova BIM";
        private const string PanelName = "瑞美暖通AI";
        
        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                // 创建Ribbon Tab
                try { application.CreateRibbonTab(TabName); }
                catch { /* Tab可能已存在 */ }
                
                // 创建Ribbon Panel
                RibbonPanel panel = application.CreateRibbonPanel(TabName, PanelName);
                
                string assemblyPath = Assembly.GetExecutingAssembly().Location;
                
                // 1. 导入BIM按钮
                PushButtonData importBtn = new PushButtonData(
                    "btnImportBIM",
                    "导入BIM\n方案",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.ImportBIMCommand"
                );
                importBtn.LargeImage = LoadImage("import.png");
                importBtn.ToolTip = "从瑞美HVAC AI平台导入BIM设计方案";
                importBtn.LongDescription = "从平台拉取已设计的暖通方案，自动转换为Revit设备族";
                
                // 2. 导出BIM按钮
                PushButtonData exportBtn = new PushButtonData(
                    "btnExportBIM",
                    "导出到\n平台",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.ExportBIMCommand"
                );
                exportBtn.LargeImage = LoadImage("export.png");
                exportBtn.ToolTip = "将当前Revit模型导出到瑞美平台进行计算和分析";
                
                // 3. 双向同步按钮
                PushButtonData syncBtn = new PushButtonData(
                    "btnSyncBIM",
                    "双向\n同步",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.SyncBIMCommand"
                );
                syncBtn.LargeImage = LoadImage("sync.png");
                syncBtn.ToolTip = "增量同步，自动检测冲突";
                
                // 4. 碰撞检测按钮
                PushButtonData clashBtn = new PushButtonData(
                    "btnClashDetection",
                    "碰撞\n检测",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.ClashDetectionCommand"
                );
                clashBtn.LargeImage = LoadImage("clash.png");
                clashBtn.ToolTip = "调用平台BVH算法进行高速碰撞检测";
                
                // 5. CFD仿真按钮
                PushButtonData cfdBtn = new PushButtonData(
                    "btnCFD",
                    "CFD\n仿真",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.CFDSimulationCommand"
                );
                cfdBtn.LargeImage = LoadImage("cfd.png");
                cfdBtn.ToolTip = "气流/温度场仿真和热舒适度分析";
                
                // 6. 设置按钮
                PushButtonData settingsBtn = new PushButtonData(
                    "btnSettings",
                    "设置",
                    assemblyPath,
                    "Rheem.Rysnova.RevitPlugin.Commands.SettingsCommand"
                );
                settingsBtn.LargeImage = LoadImage("settings.png");
                
                // 添加按钮到面板
                panel.AddItem(importBtn);
                panel.AddItem(exportBtn);
                panel.AddSeparator();
                panel.AddItem(syncBtn);
                panel.AddItem(clashBtn);
                panel.AddItem(cfdBtn);
                panel.AddSeparator();
                panel.AddItem(settingsBtn);
                
                // 注册文档事件（用于自动同步）
                application.ControlledApplication.DocumentSaved += OnDocumentSaved;
                
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Rysnova BIM", "插件加载失败: " + ex.Message);
                return Result.Failed;
            }
        }
        
        public Result OnShutdown(UIControlledApplication application)
        {
            application.ControlledApplication.DocumentSaved -= OnDocumentSaved;
            return Result.Succeeded;
        }
        
        private void OnDocumentSaved(object sender, Autodesk.Revit.DB.Events.DocumentSavedEventArgs args)
        {
            // 可选：保存时自动同步到平台
            if (PluginSettings.Current.AutoSyncOnSave)
            {
                BIMSyncService.QueueSync(args.Document);
            }
        }
        
        private BitmapImage LoadImage(string fileName)
        {
            try
            {
                string assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                string imagePath = Path.Combine(assemblyDir, "Resources", fileName);
                if (File.Exists(imagePath))
                {
                    return new BitmapImage(new Uri(imagePath));
                }
            }
            catch { }
            return null;
        }
    }
}

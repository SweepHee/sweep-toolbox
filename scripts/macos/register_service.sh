#!/bin/bash
# 간편변환기 - macOS 서비스 메뉴 등록
# Installs an Automator Service (Quick Action) for image files

PLIST_DIR="$HOME/Library/Services"
SERVICE_NAME="간편변환기"

mkdir -p "$PLIST_DIR/${SERVICE_NAME}.workflow/Contents"

cat > "$PLIST_DIR/${SERVICE_NAME}.workflow/Contents/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSServices</key>
    <array>
        <dict>
            <key>NSMenuItem</key>
            <dict>
                <key>default</key>
                <string>간편변환기로 변환</string>
            </dict>
            <key>NSMessage</key>
            <string>runWorkflowAsService</string>
            <key>NSRequiredContext</key>
            <dict>
                <key>NSApplicationIdentifier</key>
                <string>com.apple.finder</string>
            </dict>
            <key>NSSendFileTypes</key>
            <array>
                <string>public.image</string>
                <string>com.adobe.pdf</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
EOF

echo "서비스 메뉴가 등록되었습니다. Finder를 재시작해주세요."
echo "  killall Finder"

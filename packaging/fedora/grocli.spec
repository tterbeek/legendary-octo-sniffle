Name:           grocli
Version:        0.1.0
Release:        1%{?dist}
Summary:        Shared grocery and shopping lists for households

License:        MIT
URL:            https://app.grocli.net
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  cargo
BuildRequires:  rust-packaging
BuildRequires:  pkgconfig(webkit2gtk-4.1)
BuildRequires:  pkgconfig(gdk-3.0)
BuildRequires:  make

Requires:       webkit2gtk4.1

%description
GrocLi helps households share grocery lists in real-time.

%prep
%autosetup -n %{name}-%{version}

%build
# Enter the Rust project directory
pushd src-tauri

# Prepare build environment
%cargo_prep

# Build using vendored dependencies in ../vendor
CARGO_HOME=.cargo \
CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
CARGO_NET_OFFLINE=true \
cargo build --release --frozen --offline

popd


%install
# Install binary manually (we’re not using %cargo_install here)
install -Dm0755 src-tauri/target/release/app %{buildroot}%{_bindir}/grocli

# Desktop entry
install -Dm0644 src-tauri/assets/io.grocli.GrocLi.desktop \
  %{buildroot}%{_datadir}/applications/io.grocli.GrocLi.desktop

# Icon
install -Dm0644 src-tauri/icons/io.grocli.GrocLi.png \
  %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/io.grocli.GrocLi.png

# Metadata (AppStream metainfo)
install -Dm0644 src-tauri/metadata/io.grocli.GrocLi.metainfo.xml \
  %{buildroot}%{_datadir}/metainfo/io.grocli.GrocLi.metainfo.xml

%files
%{_bindir}/grocli
%{_datadir}/applications/io.grocli.GrocLi.desktop
%{_datadir}/icons/hicolor/512x512/apps/io.grocli.GrocLi.png
%{_datadir}/metainfo/io.grocli.GrocLi.metainfo.xml

%changelog
* Tue Feb 11 2025 Thijs <info@grocli.net> 0.1.0-1
- Initial COPR release


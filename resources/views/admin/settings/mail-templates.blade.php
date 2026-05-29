@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'mail-templates'])

@section('title')
    Mail Templates
@endsection

@section('content-header')
    <h1>Mail Templates<small>Edit the outgoing email copy for each panel notification.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.settings') }}">Settings</a></li>
        <li class="active">Mail Templates</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')

    <div class="row">
        <div class="col-xs-12">
            <div class="alert alert-info">
                Each card edits one outgoing email type. Use single-brace tokens like <code>&#123;name&#125;</code> wherever you want runtime values; the available tokens for each template are listed inside the card. Saving stores only the parts that differ from the built-in defaults — clearing a field reverts that field to the default copy.
                <br><strong>Preview</strong> opens the fully-branded email in a new tab and <strong>Send test</strong> delivers it to your account address — both reflect the <em>last saved</em> copy, so save your edits first. The <strong>Enabled</strong> toggle stops a template from sending; account-access emails (password reset, account creation) are always on.
            </div>

            <style>
                .tpl-box-disabled { opacity: .62; }
                .tpl-box-disabled .box-header { filter: grayscale(.3); }
                .tpl-toggle input { vertical-align: middle; margin-right: 4px; }
            </style>
        </div>
    </div>

    @foreach($templates as $tpl)
        <div class="row">
            <div class="col-xs-12">
                <div class="box {{ $tpl['enabled'] ? '' : 'tpl-box-disabled' }}" data-template-key="{{ $tpl['key'] }}" data-always-on="{{ $tpl['always_on'] ? '1' : '0' }}">
                    <div class="box-header with-border">
                        <h3 class="box-title">
                            {{ $tpl['label'] }} <small>{{ $tpl['key'] }}</small>
                            <span class="label label-default tpl-status-pill" style="margin-left:6px;{{ $tpl['enabled'] ? 'display:none' : '' }}">Disabled</span>
                        </h3>
                        <div class="box-tools pull-right">
                            @if($tpl['always_on'])
                                <span class="text-muted small" title="This template carries an account-access token and cannot be turned off."><i class="fa fa-lock"></i> Always on</span>
                            @else
                                <label class="tpl-toggle" style="margin:0;font-weight:400;cursor:pointer;">
                                    <input type="checkbox" class="tpl-enabled" {{ $tpl['enabled'] ? 'checked' : '' }}>
                                    <span class="small">Enabled</span>
                                </label>
                            @endif
                        </div>
                    </div>
                    <form>
                        <div class="box-body">
                            <p class="text-muted small" style="margin-top:0">{{ $tpl['description'] }}</p>
                            <p class="text-muted small" style="margin-top:-4px">
                                Tokens:
                                @foreach($tpl['placeholders'] as $p)
                                    <code>&#123;{{ $p }}&#125;</code>@if(!$loop->last) @endif
                                @endforeach
                            </p>
                            <div class="row">
                                <div class="form-group col-md-6">
                                    <label class="control-label">Subject</label>
                                    <input type="text" class="form-control tpl-subject" value="{{ $tpl['current']['subject'] }}" placeholder="{{ $tpl['defaults']['subject'] }}" />
                                    <p class="text-muted small">Default: <code>{{ $tpl['defaults']['subject'] }}</code></p>
                                </div>
                                <div class="form-group col-md-6">
                                    <label class="control-label">Greeting <span class="field-optional"></span></label>
                                    <input type="text" class="form-control tpl-greeting" value="{{ $tpl['current']['greeting'] }}" placeholder="{{ $tpl['defaults']['greeting'] ?: '(no greeting)' }}" />
                                    <p class="text-muted small">Renders as a heading at the top. Leave empty for no greeting.</p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="form-group col-md-12">
                                    <label class="control-label">Body</label>
                                    <textarea class="form-control tpl-lines" rows="5" placeholder="{{ $tpl['defaults']['lines'] }}">{{ $tpl['current']['lines'] }}</textarea>
                                    <p class="text-muted small">Each newline becomes a separate paragraph. Default body:</p>
                                    <pre class="text-muted small" style="background:#f5f5f5;padding:6px 10px;border-radius:3px;white-space:pre-wrap">{{ $tpl['defaults']['lines'] }}</pre>
                                </div>
                            </div>
                            <div class="row">
                                <div class="form-group col-md-4">
                                    <label class="control-label">Action button label <span class="field-optional"></span></label>
                                    <input type="text" class="form-control tpl-action-label" value="{{ $tpl['current']['action_label'] }}" placeholder="{{ $tpl['defaults']['action_label'] ?: '(no button)' }}" />
                                    <p class="text-muted small">Leave both label and URL empty to suppress the button.</p>
                                </div>
                                <div class="form-group col-md-8">
                                    <label class="control-label">Action button URL <span class="field-optional"></span></label>
                                    <input type="text" class="form-control tpl-action-url" value="{{ $tpl['current']['action_url'] }}" placeholder="{{ $tpl['defaults']['action_url'] ?: '(no button)' }}" />
                                    <p class="text-muted small">Tokens supported. The default <code>&#123;action_url&#125;</code> resolves to whatever the calling code passes (reset link, server URL, etc.).</p>
                                </div>
                            </div>
                        </div>
                        <div class="box-footer">
                            {{ csrf_field() }}
                            <div class="pull-left">
                                <a href="{{ route('admin.settings.mail-templates.preview', $tpl['key']) }}" target="_blank" class="btn btn-sm btn-default tpl-preview"><i class="fa fa-eye"></i> Preview</a>
                                <button type="button" class="btn btn-sm btn-default tpl-test"><i class="fa fa-paper-plane-o"></i> Send test</button>
                            </div>
                            <div class="pull-right">
                                <button type="button" class="btn btn-sm btn-default tpl-reset">Reset to default</button>
                                <button type="button" class="btn btn-sm btn-primary tpl-save">Save</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    @endforeach
@endsection

@section('footer-scripts')
    @parent

    <script>
        function payloadFor($box) {
            return {
                subject: $box.find('.tpl-subject').val(),
                greeting: $box.find('.tpl-greeting').val(),
                lines: $box.find('.tpl-lines').val(),
                action_label: $box.find('.tpl-action-label').val(),
                action_url: $box.find('.tpl-action-url').val(),
            };
        }

        function showError(jqXHR, verb) {
            console.error(jqXHR);
            var errorText = '';
            if (!jqXHR.responseJSON) {
                errorText = jqXHR.responseText || jqXHR.statusText;
            } else if (jqXHR.responseJSON.errors) {
                $.each(jqXHR.responseJSON.errors, function (i, v) {
                    if (v.detail) errorText += v.detail + ' ';
                });
            } else if (jqXHR.responseJSON.error) {
                errorText = jqXHR.responseJSON.error;
            }
            swal({ title: 'Whoops!', text: 'Could not ' + verb + ' template: ' + errorText, type: 'error' });
        }

        $(document).ready(function () {
            $('.tpl-save').on('click', function () {
                var $box = $(this).closest('.box');
                var key = $box.data('template-key');
                $.ajax({
                    method: 'PATCH',
                    url: '/admin/settings/mail-templates/' + encodeURIComponent(key),
                    contentType: 'application/json',
                    data: JSON.stringify(payloadFor($box)),
                    headers: { 'X-CSRF-Token': $box.find('input[name="_token"]').val() }
                }).done(function () {
                    swal({ title: 'Saved', text: 'Template updated.', type: 'success', timer: 1400, showConfirmButton: false });
                }).fail(function (jq) { showError(jq, 'save'); });
            });

            $('.tpl-reset').on('click', function () {
                var $box = $(this).closest('.box');
                var key = $box.data('template-key');
                if (!confirm('Reset "' + key + '" to its built-in default? This wipes any changes you made to this template.')) return;
                $.ajax({
                    method: 'POST',
                    url: '/admin/settings/mail-templates/' + encodeURIComponent(key) + '/reset',
                    headers: { 'X-CSRF-Token': $box.find('input[name="_token"]').val() }
                }).done(function () {
                    window.location.reload();
                }).fail(function (jq) { showError(jq, 'reset'); });
            });

            // Send a real test email of this template to the current admin.
            $('.tpl-test').on('click', function () {
                var $box = $(this).closest('.box');
                var key = $box.data('template-key');
                var $btn = $(this);
                $btn.prop('disabled', true);
                $.ajax({
                    method: 'POST',
                    url: '/admin/settings/mail-templates/' + encodeURIComponent(key) + '/test',
                    headers: { 'X-CSRF-Token': $box.find('input[name="_token"]').val() }
                }).done(function () {
                    swal({ title: 'Sent', text: 'Test email sent to your account address. It reflects the last saved copy.', type: 'success', timer: 2600, showConfirmButton: false });
                }).fail(function (jq) { showError(jq, 'send a test for'); })
                  .always(function () { $btn.prop('disabled', false); });
            });

            // Enable / disable a template (kill-switch for outgoing mail).
            $('.tpl-enabled').on('change', function () {
                var $box = $(this).closest('.box');
                var key = $box.data('template-key');
                var enabled = $(this).is(':checked');
                var $input = $(this);
                $.ajax({
                    method: 'PATCH',
                    url: '/admin/settings/mail-templates/' + encodeURIComponent(key) + '/toggle',
                    contentType: 'application/json',
                    data: JSON.stringify({ enabled: enabled }),
                    headers: { 'X-CSRF-Token': $box.find('input[name="_token"]').val() }
                }).done(function () {
                    $box.toggleClass('tpl-box-disabled', !enabled);
                    $box.find('.tpl-status-pill').toggle(!enabled);
                }).fail(function (jq) {
                    $input.prop('checked', !enabled); // revert UI on failure
                    showError(jq, 'toggle');
                });
            });
        });
    </script>
@endsection
